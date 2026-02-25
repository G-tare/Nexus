import { Events, MessageReaction, User, Client, PartialMessageReaction, PartialUser, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import { getDb } from '../../Shared/src/database/connection';
import { getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import {
  getRepConfig,
  adjustRep,
  canGiveRep,
  setRepCooldowns,
  updateRepRoles,
  processDecay,
} from './helpers';

const logger = createModuleLogger('Reputation:Events');

/**
 * Reaction-based reputation: upvote/downvote emojis on messages.
 */
const reactionRepHandler: ModuleEvent = { event: Events.MessageReactionAdd,
  async handler(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const message = reaction.message as Message;
    if (!message.guild) return;

    const config = await getRepConfig(message.guild.id);
    if (!config.reactionRepEnabled) return;

    const emoji = reaction.emoji.name || reaction.emoji.toString();
    let delta = 0;

    if (emoji === config.upvoteEmoji || reaction.emoji.toString() === config.upvoteEmoji) {
      delta = 1;
    } else if (emoji === config.downvoteEmoji || reaction.emoji.toString() === config.downvoteEmoji) {
      delta = -1;
    } else {
      return;
    }

    const targetId = message.author!.id;
    const giverId = user.id;

    // No self-rep
    if (!config.allowSelfRep && giverId === targetId) return;

    // Check cooldown
    const { allowed } = await canGiveRep(message.guild.id, giverId, targetId);
    if (!allowed) return;

    const { newRep } = await adjustRep(
      message.guild.id,
      targetId,
      delta,
      giverId,
      `Reaction ${delta > 0 ? 'upvote' : 'downvote'} on message`,
    );

    await setRepCooldowns(message.guild.id, giverId, targetId);
    await updateRepRoles(message.guild, targetId, newRep);
  },
};

/**
 * Listen for cross-module rep events from eventBus.
 * Other modules can emit 'giveReputation' events.
 */
const crossModuleRepHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    eventBus.on('giveReputation', async (data: {
      guildId: string;
      fromUserId: string;
      toUserId: string;
      amount: number;
      delta?: number;
      givenBy?: string;
      reason?: string;
    }) => {
      try {
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) return;

        const { newRep } = await adjustRep(
          data.guildId,
          data.toUserId,
          data.delta || data.amount,
          data.givenBy || 'system',
          data.reason,
        );

        await updateRepRoles(guild, data.toUserId, newRep);
      } catch (err: any) {
        logger.error('Cross-module rep error', { error: err.message });
      }
    });

    logger.info('Cross-module reputation listener active');
  },
};

/**
 * Reputation decay scheduler.
 */
const decayScheduler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    // Run decay once per hour
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          const decayed = await processDecay(guild);
          if (decayed > 0) {
            logger.debug('Processed rep decay', { guild: guild.id, users: decayed });
          }
        } catch (err: any) {
          logger.error('Rep decay error', { guild: guild.id, error: err.message });
        }
      }
    }, 60 * 60 * 1000); // Every hour
  },
};

/**
 * Passive reputation gain scheduler.
 * Awards +1 rep/week for the first month, +2 rep/week after that.
 * Cap at 100. Skips users with active punishments (warnings or mutes).
 * Runs once every 24 hours and checks if 7 days have passed since last grant.
 */
const passiveGainScheduler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    const PASSIVE_INTERVAL = 24 * 60 * 60 * 1000; // Check daily
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    const runPassiveGain = async () => {
      const db = getDb();
      const redis = getRedis();

      for (const guild of client.guilds.cache.values()) {
        try {
          // Get all guild members with reputation below 100 who don't have active punishments
          const result = await db.execute(sql`
            SELECT gm.guild_id, gm.user_id, gm.reputation, gm.joined_at, gm.warn_count, gm.is_muted
            FROM guild_members gm
            WHERE gm.guild_id = ${guild.id}
              AND gm.reputation < 100
          `);

          const rows = (result as any).rows || [];
          let awarded = 0;

          for (const row of rows) {
            // Skip users with active punishments (warnings or mutes)
            if (row.warn_count > 0 || row.is_muted) continue;

            // Check if we already gave passive rep this week
            const passiveKey = `rep:passive:${guild.id}:${row.user_id}`;
            const lastGrant = await redis.get(passiveKey);
            if (lastGrant) continue; // Already granted this week

            // Determine gain rate based on how long they've been in the server
            const joinedAt = row.joined_at ? new Date(row.joined_at).getTime() : Date.now();
            const memberDuration = Date.now() - joinedAt;
            const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

            const gain = memberDuration >= ONE_MONTH ? 2 : 1;
            const newRep = Math.min(100, row.reputation + gain);
            const actualGain = newRep - row.reputation;

            if (actualGain <= 0) continue;

            // Apply the gain to guild_members
            await db.execute(sql`
              UPDATE guild_members
              SET reputation = ${newRep}
              WHERE guild_id = ${guild.id} AND user_id = ${row.user_id}
            `);

            // Sync to reputation_users
            await db.execute(sql`
              INSERT INTO reputation_users (guild_id, user_id, reputation, last_active)
              VALUES (${guild.id}, ${row.user_id}, ${newRep}, ${Date.now()})
              ON CONFLICT (guild_id, user_id)
              DO UPDATE SET reputation = ${newRep}, last_active = ${Date.now()}
            `);

            // Log to history
            await db.execute(sql`
              INSERT INTO reputation_history (guild_id, user_id, given_by, delta, reason, created_at)
              VALUES (${guild.id}, ${row.user_id}, ${'system'}, ${actualGain}, ${'Weekly passive reputation gain'}, ${Date.now()})
            `);

            // Invalidate Redis cache
            await redis.del(`rep:${guild.id}:${row.user_id}`);

            // Set cooldown — expires in 7 days so we don't grant again this week
            await redis.setex(passiveKey, Math.floor(WEEK_MS / 1000), '1');

            // Update rep-gated roles
            await updateRepRoles(guild, row.user_id, newRep);

            awarded++;
          }

          if (awarded > 0) {
            logger.debug('Passive rep gain', { guild: guild.id, users: awarded });
          }
        } catch (err: any) {
          logger.error('Passive rep gain error', { guild: guild.id, error: err.message });
        }
      }
    };

    // Run once on startup (after a short delay), then daily
    setTimeout(() => runPassiveGain().catch(e => logger.error('Initial passive gain error', { error: e.message })), 60_000);
    setInterval(() => runPassiveGain().catch(e => logger.error('Passive gain interval error', { error: e.message })), PASSIVE_INTERVAL);

    logger.info('Passive reputation gain scheduler active');
  },
};

export const reputationEvents: ModuleEvent[] = [
  reactionRepHandler,
  crossModuleRepHandler,
  decayScheduler,
  passiveGainScheduler,
];
