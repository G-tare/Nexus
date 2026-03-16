import { cache } from '../../Shared/src/cache/cacheManager';
import {
  moduleContainer,
  infoContainer,
  addText,
  addFields,
  v2Payload,
} from '../../Shared/src/utils/componentsV2';

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
  const stored = cache.hgetall(key);

  if (!stored || Object.keys(stored).length === 0) {
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

  cache.hset(key, 'enabled', String(updated.enabled));
  cache.hset(key, 'maxMessageLength', String(updated.maxMessageLength));
  cache.hset(key, 'dmPingsOnReturn', String(updated.dmPingsOnReturn));
  cache.hset(key, 'maxPingsToTrack', String(updated.maxPingsToTrack));
  cache.hset(key, 'autoRemoveOnMessage', String(updated.autoRemoveOnMessage));
  cache.hset(key, 'bannedUsers', JSON.stringify(updated.bannedUsers));
  if (updated.logChannelId) {
    cache.hset(key, 'logChannelId', updated.logChannelId);
  }
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

  cache.hset(key, 'userId', userId);
  cache.hset(key, 'guildId', guildId);
  cache.hset(key, 'message', message);
  cache.hset(key, 'setAt', data.setAt.toISOString());
  if (nickname) {
    cache.hset(key, 'nickname', nickname);
  }

  // Add to active set
  cache.sadd(`afk:active:${guildId}`, userId);
}

export async function removeAFK(guildId: string, userId: string): Promise<AFKData | null> {
  const key = `afk:${guildId}:${userId}`;
  const stored = cache.hgetall(key);

  if (!stored || Object.keys(stored).length === 0) {
    return null;
  }

  const data: AFKData = {
    userId: stored.userId,
    guildId: stored.guildId,
    message: stored.message,
    setAt: new Date(stored.setAt),
    nickname: stored.nickname,
  };

  await cache.del(key);
  await cache.srem(`afk:active:${guildId}`, userId);

  return data;
}

export async function getAFK(guildId: string, userId: string): Promise<AFKData | null> {
  const key = `afk:${guildId}:${userId}`;
  const stored = cache.hgetall(key);

  if (!stored || Object.keys(stored).length === 0) {
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
  const userIds = await cache.smembers(`afk:active:${guildId}`);
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

  // Get current pings stored
  const current = await cache.get<PingRecord[]>(key) || [];

  // If at max, remove oldest
  if (current.length >= config.maxPingsToTrack) {
    current.shift();
  }

  // Add new ping
  current.push(ping);

  // Store and set expiry: 7 days
  await cache.set(key, current, 604800);
}

export async function getPings(guildId: string, userId: string): Promise<PingRecord[]> {
  const key = `afk:pings:${guildId}:${userId}`;
  const stored = await cache.get<PingRecord[]>(key) || [];

  return stored;
}

export async function clearPings(guildId: string, userId: string): Promise<void> {
  const key = `afk:pings:${guildId}:${userId}`;
  await cache.del(key);
}

export function buildAFKContainer(data: AFKData) {
  const container = moduleContainer('afk');
  addText(container, `### 🔴 User is AFK\n${data.message}`);
  addFields(container, [
    {
      name: 'Set',
      value: `<t:${Math.floor(data.setAt.getTime() / 1000)}:R>`,
      inline: false,
    },
  ]);
  return container;
}

export function buildPingSummaryContainer(pings: PingRecord[]) {
  const container = moduleContainer('afk');
  addText(
    container,
    `### 📬 Pings While You Were Away\n${
      pings.length > 0
        ? 'Here are all the pings you received:'
        : 'No pings received while you were away.'
    }`
  );

  if (pings.length === 0) {
    return container;
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

  addText(container, pingsText);

  if (pings.length > 20) {
    addText(container, `-# Showing last 20 of ${pings.length} pings`);
  }

  return container;
}

export function buildAFKListContainer(afkUsers: AFKData[]) {
  const container = moduleContainer('afk');
  addText(container, '### 🔴 AFK Users');

  if (afkUsers.length === 0) {
    addText(container, 'No one is AFK right now.');
    return container;
  }

  const fields = afkUsers.map((afk) => ({
    name: `<@${afk.userId}>`,
    value: `**Message:** ${afk.message}\n**Set:** <t:${Math.floor(afk.setAt.getTime() / 1000)}:R>`,
    inline: false,
  }));

  addFields(container, fields);

  return container;
}
