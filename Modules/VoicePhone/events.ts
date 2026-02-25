import {
  Events,
  Client,
  VoiceState,
  ChannelType,
  TextChannel,
  GuildMember,
  AuditLogEvent,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getActiveVoiceCall,
  endVoiceCall,
  setCooldown,
  leaveVoiceQueue,
  buildCallEndedEmbed,
  buildServerBanEmbed,
  getOtherSide,
  isUserBanned,
  tempBanServer,
  getVoicePhoneConfig,
} from './helpers';
import { activeRelays, findRelayByVoiceChannel } from './relay';
import { getRedis } from '../../Shared/src/database/connection';

const logger = createModuleLogger('VoicePhone:Events');

// Grace period timers for when a side empties
const graceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Track users we've server-muted (to detect circumvention)
// Key: `guildId:userId`, Value: timestamp of our mute action
const botMutedUsers: Map<string, number> = new Map();

/**
 * VoiceStateUpdate event handler.
 * Handles: user disconnect detection, banned user auto-mute, circumvention detection.
 */
const voiceStateUpdateEvent: ModuleEvent = {
  event: Events.VoiceStateUpdate,

  async handler(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    if (!member) return;
    const userId = member.id;

    // Skip bot's own voice state changes
    if (member.user.bot) return;

    const leftChannelId = oldState.channelId;
    const joinedChannelId = newState.channelId;

    // === CIRCUMVENTION DETECTION ===
    // If a user was server-muted by us and is now unmuted, that's circumvention
    if (oldState.serverMute && !newState.serverMute && newState.channelId) {
      await handlePossibleCircumvention(newState, member);
    }

    // === BANNED USER AUTO-MUTE ===
    // If a user joins a VC that has an active call and they're banned, server-mute them
    if (joinedChannelId && joinedChannelId !== leftChannelId) {
      await handleUserJoinedVC(joinedChannelId, userId, newState, member);
    }

    // === USER LEFT VC ===
    if (leftChannelId && leftChannelId !== joinedChannelId) {
      await handleUserLeftVC(leftChannelId, userId, oldState.client);

      // Clean up our mute tracking if they leave
      botMutedUsers.delete(`${oldState.guild.id}:${userId}`);
    }
  },
};

/**
 * Detect if server staff unmuted a user we previously muted during an active call.
 * If so, escalate: temp-ban the entire server from Voice Phone.
 */
async function handlePossibleCircumvention(state: VoiceState, member: GuildMember): Promise<void> {
  const key = `${state.guild.id}:${member.id}`;
  const mutedAt = botMutedUsers.get(key);
  if (!mutedAt) return; // We didn't mute this user, ignore

  // Only care if less than 60 seconds since our mute (recent circumvention)
  if (Date.now() - mutedAt > 60_000) {
    botMutedUsers.delete(key);
    return;
  }

  // Check if there's an active call in this channel
  const relay = state.channelId ? findRelayByVoiceChannel(state.channelId) : null;
  if (!relay) return;

  logger.warn('CIRCUMVENTION DETECTED: Staff unmuted a banned user during active call', {
    guildId: state.guild.id,
    userId: member.id,
  });

  // Re-mute the user immediately
  try {
    await member.voice.setMute(true, 'Voice Phone safety: re-enforcing mute on banned user');
    botMutedUsers.set(key, Date.now());
  } catch {
    // Might not have permission
  }

  // Escalate: temp-ban the entire server (24 hours)
  const BAN_DURATION = 86400; // 24 hours
  await tempBanServer(
    state.guild.id,
    BAN_DURATION,
    'Server staff attempted to unmute a banned user during an active Voice Phone call',
  );

  // End the active call immediately
  const call = state.channelId ? await getActiveVoiceCall(state.channelId) : null;
  if (call && !relay.isDestroyed) {
    const duration = Math.floor((Date.now() - call.startedAt) / 1000);
    relay.cleanup();
    activeRelays.delete(relay.callId);
    await endVoiceCall(relay.callId);
    await setCooldown(call.side1.guildId, call.side1.voiceChannelId);
    await setCooldown(call.side2.guildId, call.side2.voiceChannelId);

    // Notify both sides
    const endEmbed = buildCallEndedEmbed(duration, 'Safety violation — call terminated');
    notifyGuild(state.client, call.side1.guildId, endEmbed);
    notifyGuild(state.client, call.side2.guildId, endEmbed);
  }

  // Notify the offending server about the server ban
  const banEmbed = buildServerBanEmbed(BAN_DURATION, 'Staff attempted to circumvent Voice Phone safety enforcement (unmuting a banned user)');
  notifyGuild(state.client, state.guild.id, banEmbed);
}

/**
 * When a user joins a voice channel, check if they're banned from voice phone.
 * If so, server-mute them to prevent audio relay.
 * Also handles grace period cancellation.
 */
async function handleUserJoinedVC(
  channelId: string,
  userId: string,
  state: VoiceState,
  member: GuildMember,
): Promise<void> {
  // Cancel any grace period timer for this channel
  for (const [key, timer] of graceTimers) {
    if (key.endsWith(`:${channelId}`)) {
      clearTimeout(timer);
      graceTimers.delete(key);
      logger.info(`[VoicePhone] Grace period cancelled for ${channelId} — user rejoined`);
    }
  }

  // Check if there's an active call in this channel
  const relay = findRelayByVoiceChannel(channelId);
  if (!relay) return;

  // Check if this user is banned
  const banStatus = await isUserBanned(userId);
  if (banStatus.banned) {
    logger.info(`[VoicePhone] Banned user ${userId} joined active call channel — server-muting`, {
      guildId: state.guild.id,
      permanent: banStatus.permanent,
    });

    // Server-mute the user
    try {
      await member.voice.setMute(true, `Voice Phone: user is ${banStatus.permanent ? 'permanently' : 'temporarily'} banned`);
      botMutedUsers.set(`${state.guild.id}:${userId}`, Date.now());
    } catch (err) {
      logger.warn('Failed to server-mute banned user (missing permissions?)', {
        userId,
        guildId: state.guild.id,
        error: (err as Error).message,
      });
    }

    // DM the user to let them know
    try {
      const dm = await member.createDM();
      if (banStatus.permanent) {
        await dm.send({
          content: '⛔ You are **permanently banned** from Voice Phone and have been muted. You can submit an appeal using `/voicecall appeal`.',
        });
      } else {
        const remaining = banStatus.expiresAt ? Math.max(0, Math.floor((banStatus.expiresAt - Date.now()) / 1000)) : 0;
        await dm.send({
          content: `🚫 You are temporarily banned from Voice Phone and have been muted in this call.\n⏱️ Ban expires in: **${remaining > 0 ? `${Math.floor(remaining / 60)}m` : 'soon'}**`,
        });
      }
    } catch {
      // DMs might be disabled
    }
  }
}

async function handleUserLeftVC(channelId: string, userId: string, client: Client): Promise<void> {
  const relay = findRelayByVoiceChannel(channelId);
  if (!relay) return;

  // Unsubscribe this user from the relay
  const sourceSide = relay.side1.voiceChannelId === channelId ? relay.side1 : relay.side2;
  relay.unsubscribeSpeaker(sourceSide, userId);

  // Check if the voice channel is now empty (excluding the bot)
  const guild = client.guilds.cache.get(sourceSide.guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  const humanMembers = channel.members.filter(m => !m.user.bot);

  if (humanMembers.size === 0) {
    // Start a 30-second grace period
    const timerKey = `${relay.callId}:${channelId}`;

    if (graceTimers.has(timerKey)) return; // Already have a grace timer

    logger.info(`[VoicePhone] Side ${sourceSide.guildId} is empty — starting 30s grace period`);

    const timer = setTimeout(async () => {
      graceTimers.delete(timerKey);

      // Re-check if still empty
      const freshChannel = guild.channels.cache.get(channelId);
      if (freshChannel && freshChannel.type === ChannelType.GuildVoice) {
        const stillEmpty = freshChannel.members.filter(m => !m.user.bot).size === 0;
        if (!stillEmpty) return;
      }

      // End the call
      if (!relay.isDestroyed) {
        const call = await getActiveVoiceCall(channelId);
        if (!call) return;

        const duration = Math.floor((Date.now() - call.startedAt) / 1000);
        relay.cleanup();
        activeRelays.delete(relay.callId);
        await endVoiceCall(relay.callId);
        await setCooldown(call.side1.guildId, call.side1.voiceChannelId);
        await setCooldown(call.side2.guildId, call.side2.voiceChannelId);

        // Notify both sides
        const endEmbed = buildCallEndedEmbed(duration, 'Voice channel emptied');
        notifyGuild(client, call.side1.guildId, endEmbed);
        notifyGuild(client, call.side2.guildId, endEmbed);
      }
    }, 30_000);

    graceTimers.set(timerKey, timer);
  }
}

/**
 * Send a notification to the first available text channel in a guild.
 */
function notifyGuild(
  client: Client,
  guildId: string,
  embed: import('discord.js').EmbedBuilder,
): void {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const textChannel = guild.channels.cache
      .filter(ch => ch.type === ChannelType.GuildText)
      .filter(ch => {
        const perms = ch.permissionsFor(guild.members.me!);
        return perms?.has('SendMessages') ?? false;
      })
      .first() as TextChannel | undefined;

    if (textChannel) {
      textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch {
    // Non-critical
  }
}

/**
 * ClientReady event handler.
 * Cleans up orphaned voice phone call keys in Redis on bot restart.
 */
const clientReadyEvent: ModuleEvent = {
  event: Events.ClientReady,
  once: true,

  async handler(client: Client) {
    logger.info('[VoicePhone] Cleaning up orphaned call keys...');

    const redis = getRedis();
    let cursor = '0';
    let cleaned = 0;

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'voicephone:call:*', 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        await redis.del(key);
        cleaned++;
      }
    } while (cursor !== '0');

    // Also clean up channel mappings
    cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'voicephone:channel:*', 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        await redis.del(key);
        cleaned++;
      }
    } while (cursor !== '0');

    // Clean up queue entries
    await redis.del('voicephone:queue');

    if (cleaned > 0) {
      logger.info(`[VoicePhone] Cleaned up ${cleaned} orphaned keys`);
    }
  },
};

export const voicephoneEvents: ModuleEvent[] = [
  voiceStateUpdateEvent,
  clientReadyEvent,
];
