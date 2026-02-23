import { EmbedBuilder } from 'discord.js';
import { getRedis } from '../../Shared/src/database/connection';
const redis = getRedis();

export interface AFKConfig {
  enabled: boolean;
  maxMessageLength: number;
  dmPingsOnReturn: boolean;
  maxPingsToTrack: number;
  autoRemoveOnMessage: boolean;
  bannedUsers: string[];
  logChannelId?: string;
}

export interface AFKData {
  userId: string;
  guildId: string;
  message: string;
  setAt: Date;
  nickname?: string;
}

export interface PingRecord {
  fromUserId: string;
  fromUsername: string;
  channelId: string;
  channelName: string;
  messageContent: string;
  timestamp: number;
}

const DEFAULT_CONFIG: AFKConfig = {
  enabled: true,
  maxMessageLength: 200,
  dmPingsOnReturn: true,
  maxPingsToTrack: 50,
  autoRemoveOnMessage: true,
  bannedUsers: [],
};

export async function getAFKConfig(guildId: string): Promise<AFKConfig> {
  const key = `afk:config:${guildId}`;
  const stored = await redis.hgetall(key);

  if (Object.keys(stored).length === 0) {
    return DEFAULT_CONFIG;
  }

  return {
    enabled: stored.enabled === 'true' ? true : false,
    maxMessageLength: parseInt(stored.maxMessageLength || String(DEFAULT_CONFIG.maxMessageLength), 10),
    dmPingsOnReturn: stored.dmPingsOnReturn === 'true' ? true : false,
    maxPingsToTrack: parseInt(stored.maxPingsToTrack || String(DEFAULT_CONFIG.maxPingsToTrack), 10),
    autoRemoveOnMessage: stored.autoRemoveOnMessage === 'true' ? true : false,
    bannedUsers: stored.bannedUsers ? JSON.parse(stored.bannedUsers) : [],
    logChannelId: stored.logChannelId || undefined,
  };
}

export async function setAFKConfig(guildId: string, config: Partial<AFKConfig>): Promise<void> {
  const key = `afk:config:${guildId}`;
  const current = await getAFKConfig(guildId);
  const updated = { ...current, ...config };

  await redis.hset(key, {
    enabled: String(updated.enabled),
    maxMessageLength: String(updated.maxMessageLength),
    dmPingsOnReturn: String(updated.dmPingsOnReturn),
    maxPingsToTrack: String(updated.maxPingsToTrack),
    autoRemoveOnMessage: String(updated.autoRemoveOnMessage),
    bannedUsers: JSON.stringify(updated.bannedUsers),
    ...(updated.logChannelId && { logChannelId: updated.logChannelId }),
  });
}

export async function setAFK(
  guildId: string,
  userId: string,
  message: string,
  nickname?: string
): Promise<void> {
  const key = `afk:${guildId}:${userId}`;
  const data: AFKData = {
    userId,
    guildId,
    message,
    setAt: new Date(),
    nickname,
  };

  await redis.hset(key, {
    userId,
    guildId,
    message,
    setAt: data.setAt.toISOString(),
    ...(nickname && { nickname }),
  });

  // Add to active set
  await redis.sadd(`afk:active:${guildId}`, userId);
}

export async function removeAFK(guildId: string, userId: string): Promise<AFKData | null> {
  const key = `afk:${guildId}:${userId}`;
  const stored = await redis.hgetall(key);

  if (Object.keys(stored).length === 0) {
    return null;
  }

  const data: AFKData = {
    userId: stored.userId,
    guildId: stored.guildId,
    message: stored.message,
    setAt: new Date(stored.setAt),
    nickname: stored.nickname,
  };

  await redis.del(key);
  await redis.srem(`afk:active:${guildId}`, userId);

  return data;
}

export async function getAFK(guildId: string, userId: string): Promise<AFKData | null> {
  const key = `afk:${guildId}:${userId}`;
  const stored = await redis.hgetall(key);

  if (Object.keys(stored).length === 0) {
    return null;
  }

  return {
    userId: stored.userId,
    guildId: stored.guildId,
    message: stored.message,
    setAt: new Date(stored.setAt),
    nickname: stored.nickname,
  };
}

export async function getAllAFK(guildId: string): Promise<AFKData[]> {
  const userIds = await redis.smembers(`afk:active:${guildId}`);
  const afkUsers: AFKData[] = [];

  for (const userId of userIds) {
    const afk = await getAFK(guildId, userId);
    if (afk) {
      afkUsers.push(afk);
    }
  }

  return afkUsers;
}

export async function isAFKBanned(guildId: string, userId: string): Promise<boolean> {
  const config = await getAFKConfig(guildId);
  return config.bannedUsers.includes(userId);
}

export async function trackPing(
  guildId: string,
  afkUserId: string,
  ping: PingRecord
): Promise<void> {
  const key = `afk:pings:${guildId}:${afkUserId}`;
  const config = await getAFKConfig(guildId);

  // Get current count
  const current = await redis.lrange(key, 0, -1);

  // If at max, remove oldest
  if (current.length >= config.maxPingsToTrack) {
    await redis.lpop(key);
  }

  // Add new ping (to the right/end)
  await redis.rpush(key, JSON.stringify(ping));

  // Set expiry: 7 days
  await redis.expire(key, 604800);
}

export async function getPings(guildId: string, userId: string): Promise<PingRecord[]> {
  const key = `afk:pings:${guildId}:${userId}`;
  const stored = await redis.lrange(key, 0, -1);

  return stored.map((item) => JSON.parse(item));
}

export async function clearPings(guildId: string, userId: string): Promise<void> {
  const key = `afk:pings:${guildId}:${userId}`;
  await redis.del(key);
}

export function buildAFKEmbed(data: AFKData): EmbedBuilder {
  const durationMs = Date.now() - data.setAt.getTime();
  const durationMin = Math.floor(durationMs / 60000);

  return new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle('🔴 User is AFK')
    .setDescription(data.message)
    .addFields({
      name: 'Set',
      value: `<t:${Math.floor(data.setAt.getTime() / 1000)}:R>`,
      inline: false,
    })
    .setTimestamp();
}

export function buildPingSummaryEmbed(pings: PingRecord[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📬 Pings While You Were Away')
    .setDescription(pings.length > 0 ? 'Here are all the pings you received:' : 'No pings received while you were away.')
    .setTimestamp();

  if (pings.length === 0) {
    return embed;
  }

  // Group pings for better readability to 20 pings displayed
  const displayPings = pings.slice(-20);
  const pingsText = displayPings
    .map((ping) => {
      const truncatedMsg = ping.messageContent.length > 50
        ? ping.messageContent.slice(0, 47) + '...'
        : ping.messageContent;
      return `**${ping.fromUsername}** in #${ping.channelName}:\n> ${truncatedMsg}\n<t:${ping.timestamp}:R>`;
    })
    .join('\n\n');

  embed.setDescription(pingsText);

  if (pings.length > 20) {
    embed.setFooter({ text: `Showing last 20 of ${pings.length} pings` });
  }

  return embed;
}

export function buildAFKListEmbed(afkUsers: AFKData[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🔴 AFK Users')
    .setTimestamp();

  if (afkUsers.length === 0) {
    embed.setDescription('No one is AFK right now.');
    return embed;
  }

  const fields = afkUsers.map((afk) => {
    const durationMin = Math.floor((Date.now() - afk.setAt.getTime()) / 60000);
    return {
      name: `<@${afk.userId}>`,
      value: `**Message:** ${afk.message}\n**Set:** <t:${Math.floor(afk.setAt.getTime() / 1000)}:R>`,
      inline: false,
    };
  });

  embed.addFields(...fields);

  return embed;
}
