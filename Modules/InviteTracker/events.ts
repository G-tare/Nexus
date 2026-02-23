import {
  Events,
  Guild,
  GuildMember,
  EmbedBuilder,
  ColorResolvable,
  ChannelType,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getInviteConfig,
  cacheGuildInvites,
  findUsedInvite,
  recordInvite,
  recordLeave,
  checkFakeInvite,
  markInviteAsFake,
  getInviterStats,
  logInviteEvent,
} from './helpers';

/**
 * Cache invites on bot startup
 */
const inviteCacheHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client) {
    console.log('[InviteTracker] Caching invites for all guilds...');
    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }
    console.log('[InviteTracker] Invite cache complete');
  },
};

/**
 * Update cache when invite is created
 */
const inviteCreateHandler: ModuleEvent = { event: Events.InviteCreate,
  async handler(invite) {
    if (!invite.guild) return;
    await cacheGuildInvites(invite.guild);
  },
};

/**
 * Update cache when invite is deleted
 */
const inviteDeleteHandler: ModuleEvent = { event: Events.InviteDelete,
  async handler(invite) {
    if (!invite.guild) return;
    await cacheGuildInvites(invite.guild);
  },
};

/**
 * Handle member joins
 */
const memberJoinHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    const guild = member.guild;
    const config = await getInviteConfig(guild.id);

    if (!config.enabled || !config.trackJoins) return;

    try {
      // Find which invite was used
      const usedCode = await findUsedInvite(guild);
      if (!usedCode) return;

      // Fetch the invite details
      let invitedBy: GuildMember | null = null;
      try {
        const invites = await guild.invites.fetch();
        const invite = invites.get(usedCode);
        if (invite && invite.inviter) {
          invitedBy = await guild.members.fetch(invite.inviter.id).catch(() => null);
        }
      } catch (error) {
        console.error('Failed to fetch invite details:', error);
      }

      if (!invitedBy) return;

      // Check for fake invite
      const isFake = await checkFakeInvite(member, config);

      if (isFake && config.trackFakes) {
        // Mark as fake
        await markInviteAsFake(guild.id, member.id);
      } else {
        // Record legitimate invite
        await recordInvite(guild.id, invitedBy.id, member.id, usedCode);
      }

      // Get updated stats
      const stats = await getInviterStats(guild.id, invitedBy.id);

      // Announce join if enabled
      if (config.announceJoins && config.announceChannelId) {
        try {
          const channel = await guild.channels.fetch(config.announceChannelId);
          if (channel && channel.isTextBased() && channel.type === ChannelType.GuildText) {
            const announceEmbed = new EmbedBuilder()
              .setColor('#57F287' as ColorResolvable)
              .setTitle('Member Joined')
              .setDescription(`${member} joined the server`)
              .addFields(
                {
                  name: 'Invited By',
                  value: `${invitedBy}`,
                  inline: true,
                },
                { name: `${invitedBy.displayName}'s Invites`,
                  value: stats.real.toString(),
                  inline: true,
                }
              );

            if (isFake) {
              announceEmbed.addFields({
                name: 'Status',
                value: '⚠️ Fake invite (new account)',
                inline: false,
              });
            }

            announceEmbed.setTimestamp();

            await (channel as any).send({ embeds: [announceEmbed] });
          }
        } catch (error) {
          console.error('Failed to announce join:', error);
        }
      }

      // Log event
      const eventDetails = isFake
        ? `${member.user.tag} joined (marked as fake) - Invited by ${invitedBy.user.tag}`
        : `${member.user.tag} joined - Invited by ${invitedBy.user.tag} (now has ${stats.real} invites)`;

      await logInviteEvent(guild, config, 'Member Joined', eventDetails);
    } catch (error) {
      console.error('[InviteTracker] Error handling member join:', error);
    }
  },
};

/**
 * Handle member leaves
 */
const memberLeaveHandler: ModuleEvent = { event: Events.GuildMemberRemove,
  async handler(member: GuildMember | { id: string; guild: Guild; user: { tag: string } }) {
    const guild = member.guild;
    const config = await getInviteConfig(guild.id);

    if (!config.enabled || !config.trackLeaves) return;

    try {
      // Record the leave
      await recordLeave(guild.id, member.id);

      // Log event
      await logInviteEvent(
        guild,
        config,
        'Member Left',
        `${member.user ? member.user.tag : 'Unknown#0000'} left the server`
      );
    } catch (error) {
      console.error('[InviteTracker] Error handling member leave:', error);
    }
  },
};

export const inviteTrackerEvents: ModuleEvent[] = [
  inviteCacheHandler,
  inviteCreateHandler,
  inviteDeleteHandler,
  memberJoinHandler,
  memberLeaveHandler,
];
