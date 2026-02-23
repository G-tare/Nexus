import { GuildMember, Message, EmbedBuilder, TextChannel, Guild, PermissionFlagsBits } from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getRedis } from '../../Shared/src/database/connection';
import { Colors } from '../../Shared/src/utils/embed';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import crypto from 'crypto';

const logger = createModuleLogger('Automod');

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface AutomodConfig {
  // Anti-spam
  antispam: {
    enabled: boolean;
    maxMessages: number;
    timeframeSeconds: number;
    duplicateThreshold: number;
    maxEmojis: number;
    maxCaps: number;
    maxMentions: number;
    minMessageLength: number;
  };

  // Anti-raid
  antiraid: {
    enabled: boolean;
    joinThreshold: number;
    timeframeSeconds: number;
    minAccountAgeDays: number;
    action: 'kick' | 'ban' | 'lockdown';
    lockdownDurationMinutes: number;
  };

  // Anti-link
  antilink: {
    enabled: boolean;
    whitelistedDomains: string[];
    blacklistedDomains: string[];
    allowedChannels: string[];
    allowedRoles: string[];
  };

  // Anti-invite
  antiinvite: {
    enabled: boolean;
    allowedServers: string[];
    allowedRoles: string[];
  };

  // Word filter
  wordfilter: {
    enabled: boolean;
    words: string[];
    wildcards: string[];
    regexPatterns: string[];
  };

  // Anti-nuke
  antinuke: {
    enabled: boolean;
    maxChannelDeletesPerMinute: number;
    maxRoleDeletesPerMinute: number;
    maxBansPerMinute: number;
    maxWebhookCreatesPerMinute: number;
    action: 'strip' | 'ban' | 'kick';
  };

  // Punishment escalation
  punishments: {
    1: AutomodAction;
    2: AutomodAction;
    3: AutomodAction;
    4: AutomodAction;
    5: AutomodAction;
  };

  // Exemptions
  exemptRoles: string[];
  exemptChannels: string[];
  exemptUsers: string[];

  // Logging
  logChannelId?: string;
}

export type AutomodAction =
  | { type: 'delete' }
  | { type: 'warn' }
  | { type: 'mute'; duration: number }
  | { type: 'kick' }
  | { type: 'ban' };

export const DEFAULT_AUTOMOD_CONFIG: AutomodConfig = {
  antispam: {
    enabled: true,
    maxMessages: 5,
    timeframeSeconds: 5,
    duplicateThreshold: 3,
    maxEmojis: 10,
    maxCaps: 80,
    maxMentions: 5,
    minMessageLength: 1,
  },
  antiraid: {
    enabled: false,
    joinThreshold: 10,
    timeframeSeconds: 60,
    minAccountAgeDays: 0,
    action: 'kick',
    lockdownDurationMinutes: 30,
  },
  antilink: {
    enabled: false,
    whitelistedDomains: [],
    blacklistedDomains: [],
    allowedChannels: [],
    allowedRoles: [],
  },
  antiinvite: {
    enabled: false,
    allowedServers: [],
    allowedRoles: [],
  },
  wordfilter: {
    enabled: false,
    words: [],
    wildcards: [],
    regexPatterns: [],
  },
  antinuke: {
    enabled: false,
    maxChannelDeletesPerMinute: 5,
    maxRoleDeletesPerMinute: 5,
    maxBansPerMinute: 10,
    maxWebhookCreatesPerMinute: 5,
    action: 'ban',
  },
  punishments: {
    1: { type: 'delete' },
    2: { type: 'warn' },
    3: { type: 'mute', duration: 600 },
    4: { type: 'kick' },
    5: { type: 'ban' },
  },
  exemptRoles: [],
  exemptChannels: [],
  exemptUsers: [],
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get automod config for a guild, with defaults merged in
 */
export async function getAutomodConfig(guildId: string): Promise<AutomodConfig> {
  try {
    const result = await moduleConfig.getModuleConfig<AutomodConfig>(guildId, 'automod');
    if (!result) return { ...DEFAULT_AUTOMOD_CONFIG };
    return { ...DEFAULT_AUTOMOD_CONFIG, ...result.config };
  } catch (error) {
    logger.error(`Failed to get automod config for guild ${guildId}:`, error);
    return DEFAULT_AUTOMOD_CONFIG;
  }
}

// ============================================================================
// EXEMPTION CHECKS
// ============================================================================

/**
 * Check if a member/channel is exempt from automod
 */
export function isExempt(member: GuildMember, config: AutomodConfig, channelId: string): boolean {
  // Admins are always exempt
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check user exemption
  if (config.exemptUsers.includes(member.id)) {
    return true;
  }

  // Check channel exemption
  if (config.exemptChannels.includes(channelId)) {
    return true;
  }

  // Check role exemption
  for (const roleId of member.roles.cache.keys()) {
    if (config.exemptRoles.includes(roleId)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// SPAM & RATE LIMITING
// ============================================================================

/**
 * Check if user is spamming messages (rate limit check via Redis sorted set)
 */
export async function checkSpamRate(
  guildId: string,
  userId: string,
  config: AutomodConfig
): Promise<boolean> {
  if (!config.antispam.enabled) return false;

  const redis = await getRedis();
  const key = `automod:spam:${guildId}:${userId}`;
  const now = Date.now();
  const windowStart = now - config.antispam.timeframeSeconds * 1000;

  try {
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, '-inf', windowStart);

    // Get count of messages in current window
    const count = await redis.zcard(key);

    if (count >= config.antispam.maxMessages) {
      return true; // Spam detected
    }

    // Add current timestamp
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    await redis.expire(key, config.antispam.timeframeSeconds + 1);

    return false;
  } catch (error) {
    logger.error(`Error checking spam rate for ${userId}:`, error);
    return false;
  }
}

/**
 * Check for duplicate message spam using message content hash
 */
export async function checkDuplicates(
  guildId: string,
  userId: string,
  content: string,
  config: AutomodConfig
): Promise<boolean> {
  if (!config.antispam.enabled || config.antispam.duplicateThreshold === 0) {
    return false;
  }

  const redis = await getRedis();
  const key = `automod:dup:${guildId}:${userId}`;
  const hash = crypto.createHash('md5').update(content).digest('hex');

  try {
    // Get list of recent hashes
    const recent = await redis.lrange(key, 0, -1);

    // Count how many times this hash appears
    const duplicateCount = recent.filter((h) => h === hash).length;

    if (duplicateCount >= config.antispam.duplicateThreshold) {
      return true; // Duplicate spam detected
    }

    // Add hash to list
    await redis.lpush(key, hash);
    await redis.ltrim(key, 0, 10); // Keep only last 10 messages
    await redis.expire(key, 60); // 1 minute window

    return false;
  } catch (error) {
    logger.error(`Error checking duplicates for ${userId}:`, error);
    return false;
  }
}

// ============================================================================
// CONTENT CHECKS
// ============================================================================

/**
 * Check if message has too many emojis (both unicode and custom)
 */
export function checkEmojis(content: string, maxEmojis: number): boolean {
  if (maxEmojis === 0) return false;

  // Unicode emoji regex (comprehensive)
  const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
  const unicodeEmojis = content.match(emojiRegex) || [];

  // Custom Discord emoji regex: <:name:id> or <a:name:id>
  const customEmojiRegex = /<a?:\w+:\d+>/g;
  const customEmojis = content.match(customEmojiRegex) || [];

  const totalEmojis = unicodeEmojis.length + customEmojis.length;
  return totalEmojis > maxEmojis;
}

/**
 * Check if message has too many capital letters
 */
export function checkCaps(content: string, maxPercent: number, minLength: number): boolean {
  if (maxPercent === 0 || content.length < minLength) return false;

  // Remove non-letter characters for cap percentage
  const lettersOnly = content.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length === 0) return false;

  const capsCount = (lettersOnly.match(/[A-Z]/g) || []).length;
  const capsPercent = (capsCount / lettersOnly.length) * 100;

  return capsPercent > maxPercent;
}

/**
 * Check if message has too many mentions
 */
export function checkMentions(message: Message, maxMentions: number): boolean {
  if (maxMentions === 0) return false;

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  return mentionCount > maxMentions;
}

/**
 * Check if message contains disallowed links
 */
export function checkLinks(content: string, config: AutomodConfig['antilink']): boolean {
  if (!config.enabled) return false;

  // URL regex pattern
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
  const urls = content.match(urlRegex) || [];

  for (const url of urls) {
    let domain: string;
    try {
      domain = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }

    // If blacklist is empty, allow only whitelisted domains
    if (config.blacklistedDomains.length === 0) {
      if (!config.whitelistedDomains.some((d) => domain.includes(d.toLowerCase()))) {
        return true; // Link violation
      }
    } else {
      // If blacklist exists, block only blacklisted domains
      if (config.blacklistedDomains.some((d) => domain.includes(d.toLowerCase()))) {
        return true; // Link violation
      }
    }
  }

  return false;
}

/**
 * Check if message contains Discord invites
 */
export function checkInvites(content: string): boolean {
  const inviteRegex = /(?:https?:\/\/)?(?:www\.)?discord\.(?:gg|com\/invite)\/[\w-]+/gi;
  return inviteRegex.test(content);
}

/**
 * Check if message contains filtered words/patterns
 */
export function checkWordFilter(
  content: string,
  config: AutomodConfig['wordfilter']
): { matched: boolean; trigger?: string } {
  if (!config.enabled) {
    return { matched: false };
  }

  const lowerContent = content.toLowerCase();

  // Check exact word matches
  for (const word of config.words) {
    if (lowerContent.includes(word.toLowerCase())) {
      return { matched: true, trigger: word };
    }
  }

  // Check wildcard patterns (e.g., "n*gger")
  for (const pattern of config.wildcards) {
    const regexPattern = pattern
      .toLowerCase()
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Replace * with regex wildcard
    try {
      const regex = new RegExp(regexPattern, 'i');
      if (regex.test(lowerContent)) {
        return { matched: true, trigger: pattern };
      }
    } catch (error) {
      logger.warn(`Invalid wildcard pattern: ${pattern}`);
    }
  }

  // Check regex patterns
  for (const pattern of config.regexPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(content)) {
        return { matched: true, trigger: pattern };
      }
    } catch (error) {
      logger.warn(`Invalid regex pattern: ${pattern}`);
    }
  }

  return { matched: false };
}

// ============================================================================
// OFFENSE TRACKING
// ============================================================================

/**
 * Get number of offenses for a user (with 24h expiry)
 */
export async function getUserOffenseCount(guildId: string, userId: string): Promise<number> {
  const redis = await getRedis();
  const key = `automod:offenses:${guildId}:${userId}`;

  try {
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    logger.error(`Error getting offense count for ${userId}:`, error);
    return 0;
  }
}

/**
 * Increment offense count and return new count (with 24h expiry)
 */
export async function incrementOffense(guildId: string, userId: string): Promise<number> {
  const redis = await getRedis();
  const key = `automod:offenses:${guildId}:${userId}`;

  try {
    const newCount = await redis.incr(key);
    await redis.expire(key, 86400); // 24 hours
    return newCount;
  } catch (error) {
    logger.error(`Error incrementing offense for ${userId}:`, error);
    return 0;
  }
}

/**
 * Get escalated action based on offense count
 */
export function getEscalatedAction(offenseCount: number, config: AutomodConfig): AutomodAction {
  const count = Math.min(Math.max(offenseCount, 1), 5) as 1 | 2 | 3 | 4 | 5;
  return config.punishments[count];
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

/**
 * Execute an automod action (delete, warn, mute, kick, ban)
 */
export async function executeAction(action: AutomodAction, message: Message, reason: string): Promise<void> {
  try {
    switch (action.type) {
      case 'delete':
        await message.delete().catch((error) => {
          logger.warn(`Failed to delete message ${message.id}:`, error);
        });
        break;

      case 'warn':
        // Create a mod case via warn system (assumes warn command exists)
        // This would integrate with your mod case system
        logger.info(`Warning user ${message.author.id} for: ${reason}`);
        // TODO: Call warn function from moderation module
        break;

      case 'mute':
        if (message.member) {
          const muteRole = message.guild?.roles.cache.find((r) => r.name.toLowerCase() === 'muted');
          if (muteRole && message.member.manageable) {
            await message.member.roles.add(muteRole).catch((error) => {
              logger.warn(`Failed to mute user ${message.author.id}:`, error);
            });

            // Schedule unmute
            const duration = action.duration * 1000;
            setTimeout(
              async () => {
                try {
                  await message.member?.roles.remove(muteRole);
                } catch (error) {
                  logger.warn(`Failed to unmute user ${message.author.id}:`, error);
                }
              },
              duration
            );
          }
        }
        break;

      case 'kick':
        if (message.member?.kickable) {
          await message.member.kick(reason).catch((error) => {
            logger.warn(`Failed to kick user ${message.author.id}:`, error);
          });
        }
        break;

      case 'ban':
        if (message.guild?.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
          await message.guild.bans.create(message.author.id, { reason }).catch((error) => {
            logger.warn(`Failed to ban user ${message.author.id}:`, error);
          });
        }
        break;
    }
  } catch (error) {
    logger.error(`Error executing action ${action.type}:`, error);
  }
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log an automod action to the configured log channel
 */
export async function logAutomodAction(
  guild: Guild,
  config: AutomodConfig,
  userId: string,
  action: string,
  reason: string,
  details?: string
): Promise<void> {
  if (!config.logChannelId) return;

  try {
    const channel = (await guild.channels.fetch(config.logChannelId)) as TextChannel;
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('Automod Action')
      .setColor(Colors.Warning)
      .addFields(
        { name: 'User ID', value: userId, inline: true },
        { name: 'Action', value: action, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Timestamp', value: new Date().toISOString(), inline: true }
      );

    if (details) {
      embed.addFields({ name: 'Details', value: details });
    }

    await channel.send({ embeds: [embed] }).catch((error: any) => {
      logger.warn(`Failed to log automod action:`, error);
    });
  } catch (error) {
    logger.error(`Error logging automod action:`, error);
  }
}

// ============================================================================
// NUKE DETECTION
// ============================================================================

/**
 * Check and increment nuke action counter (with 60s TTL per action type)
 */
export async function checkNukeAction(guildId: string, actionType: string): Promise<number> {
  const redis = await getRedis();
  const key = `automod:nuke:${guildId}:${actionType}`;

  try {
    const count = await redis.incr(key);
    await redis.expire(key, 60); // 60 second window
    return count;
  } catch (error) {
    logger.error(`Error checking nuke action for ${actionType}:`, error);
    return 0;
  }
}
