import { GuildMember, Guild, AttachmentBuilder, TextChannel, ContainerBuilder } from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { cache } from '../../Shared/src/cache/cacheManager';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  addText,
  addFields,
  addSeparator,
  addSectionWithThumbnail,
  addMediaGallery,
  addFooter,
  v2Payload,
} from '../../Shared/src/utils/componentsV2';
// Lazy-load canvas — try @napi-rs/canvas first (prebuilt), fall back to node-canvas
let createCanvas: any;
let loadImage: any;
try {
  const napi = require('@napi-rs/canvas');
  createCanvas = (w: number, h: number) => napi.createCanvas(w, h);
  loadImage = (src: string) => napi.loadImage(src);
} catch {
  try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
    loadImage = canvasModule.loadImage;
  } catch {
    // No canvas library available — image-based welcome cards will be disabled
  }
}

const logger = createModuleLogger('Welcome');

/**
 * Welcome module configuration interface
 */
export interface WelcomeConfig {
  // Welcome messages
  welcome: {
    enabled: boolean;
    channelId?: string;
    message: string;           // supports placeholders
    useEmbed: boolean;
    embedColor?: string;       // hex color for embed
    embedTitle?: string;
    embedFooter?: string;
    embedThumbnail: boolean;   // show user avatar as thumbnail
    embedImage?: string;       // custom image URL for embed
    showImage: boolean;        // generate canvas welcome image
    imageBackground?: string;  // custom background URL for canvas image
  };

  // Leave messages
  leave: {
    enabled: boolean;
    channelId?: string;
    message: string;
    useEmbed: boolean;
    embedColor?: string;
    embedTitle?: string;
  };

  // DM on join
  dm: {
    enabled: boolean;
    message: string;
    useEmbed: boolean;
  };

  // Autoroles
  autorole: {
    enabled: boolean;
    roles: string[];           // role IDs to assign
    delaySeconds: number;      // delay before assigning (0 = immediate)
    botRoles: string[];        // separate roles for bots
  };

  // First-message greet
  greet: {
    enabled: boolean;
    channelId?: string;        // if set, greet in this channel; otherwise greet where they first talk
    message: string;
  };

  // Member screening
  screening: {
    enabled: boolean;
    verifiedRoleId?: string;   // role granted after verification
    message: string;           // verification instructions
  };

  // Join gate
  joingate: {
    enabled: boolean;
    minAccountAgeDays: number;
    action: 'kick' | 'quarantine';
    verifyChannelId?: string;  // channel where new accounts can verify
    logKicks: boolean;
  };
}

/**
 * Default welcome configuration
 */
export const DEFAULT_WELCOME_CONFIG: WelcomeConfig = {
  welcome: {
    enabled: false,
    message: 'Welcome to **{server}**, {user}! You are member #{membercount}.',
    useEmbed: true,
    embedColor: '#5865F2',
    embedTitle: 'Welcome!',
    embedFooter: '',
    embedThumbnail: true,
    showImage: false,
  },
  leave: {
    enabled: false,
    message: '**{username}** has left the server. We now have {membercount} members.',
    useEmbed: true,
    embedColor: '#ED4245',
    embedTitle: 'Goodbye!',
  },
  dm: {
    enabled: false,
    message: 'Welcome to **{server}**! Please read the rules and enjoy your stay.',
    useEmbed: false,
  },
  autorole: {
    enabled: false,
    roles: [],
    delaySeconds: 0,
    botRoles: [],
  },
  greet: {
    enabled: false,
    message: 'Welcome {user}, thanks for chatting! Feel free to introduce yourself.',
  },
  screening: {
    enabled: false,
    message: 'Please react to this message or use /verify to gain access to the server.',
  },
  joingate: {
    enabled: false,
    minAccountAgeDays: 7,
    action: 'kick',
    logKicks: true,
  },
};

/**
 * Get welcome configuration for a guild
 * Returns config from moduleConfig with defaults applied
 */
export async function getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'welcome');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return {
      ...DEFAULT_WELCOME_CONFIG,
      ...config,
      welcome: { ...DEFAULT_WELCOME_CONFIG.welcome, ...config?.welcome },
      leave: { ...DEFAULT_WELCOME_CONFIG.leave, ...config?.leave },
      dm: { ...DEFAULT_WELCOME_CONFIG.dm, ...config?.dm },
      autorole: { ...DEFAULT_WELCOME_CONFIG.autorole, ...config?.autorole },
      greet: { ...DEFAULT_WELCOME_CONFIG.greet, ...config?.greet },
      screening: { ...DEFAULT_WELCOME_CONFIG.screening, ...config?.screening },
      joingate: { ...DEFAULT_WELCOME_CONFIG.joingate, ...config?.joingate },
    };
  } catch (error) {
    logger.error(`Failed to get welcome config for guild ${guildId}:`, error);
    return DEFAULT_WELCOME_CONFIG;
  }
}

/**
 * Replace placeholders in text with member information
 * Supported placeholders:
 * - {user} → member mention
 * - {username} → member.user.username
 * - {usertag} → member.user.tag
 * - {server} → member.guild.name
 * - {membercount} → member.guild.memberCount
 * - {createdate} → member.user.createdAt formatted
 * - {joindate} → member.joinedAt formatted or current date
 * - {id} → member.id
 */
export function replacePlaceholders(text: string, member: GuildMember): string {
  let result = text;

  const createdAtDate = member.user.createdAt
    ? member.user.createdAt.toLocaleDateString()
    : 'Unknown';
  const joinedDate = member.joinedAt
    ? member.joinedAt.toLocaleDateString()
    : new Date().toLocaleDateString();

  const replacements: Record<string, string> = {
    '{user}': member.toString(), // mention
    '{username}': member.user.username,
    '{usertag}': member.user.tag,
    '{server}': member.guild.name,
    '{membercount}': member.guild.memberCount.toString(),
    '{createdate}': createdAtDate,
    '{joindate}': joinedDate,
    '{id}': member.id,
  };

  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });

  return result;
}

/**
 * Build a welcome container from configuration
 */
export function buildWelcomeContainer(
  member: GuildMember,
  config: WelcomeConfig['welcome']
): ContainerBuilder {
  const container = moduleContainer('welcome');

  // Add title/header with thumbnail if enabled
  const description = replacePlaceholders(config.message, member);
  const title = config.embedTitle ? `### ${config.embedTitle}` : '';

  if (config.embedThumbnail) {
    const avatarUrl = member.user.displayAvatarURL({ size: 256 });
    const content = title ? `${title}\n${description}` : description;
    addSectionWithThumbnail(container, content, avatarUrl);
  } else {
    const content = title ? `${title}\n${description}` : description;
    addText(container, content);
  }

  // Add separator if there's more content to come
  if (config.embedImage || config.embedFooter) {
    addSeparator(container, 'small');
  }

  // Add image if provided
  if (config.embedImage) {
    addMediaGallery(container, [{ url: config.embedImage }]);
  }

  // Add footer if provided
  if (config.embedFooter) {
    addFooter(container, config.embedFooter);
  }

  return container;
}

/**
 * Build a leave container from configuration
 */
export function buildLeaveContainer(
  member: GuildMember,
  config: WelcomeConfig['leave']
): ContainerBuilder {
  const container = errorContainer(
    config.embedTitle || 'Goodbye',
    replacePlaceholders(config.message, member)
  );

  return container;
}

/**
 * Build a DM container from configuration
 */
export function buildDmContainer(
  member: GuildMember,
  config: WelcomeConfig['dm']
): ContainerBuilder {
  const container = moduleContainer('welcome');

  const description = replacePlaceholders(config.message, member);
  const avatarUrl = member.user.displayAvatarURL({ size: 256 });

  addSectionWithThumbnail(container, description, avatarUrl);

  return container;
}

/**
 * Generate a welcome image using Canvas
 * Creates a 900x300 canvas with member info
 */
export async function generateWelcomeImage(
  member: GuildMember
): Promise<AttachmentBuilder | null> {
  try {
    // Create canvas
    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext('2d');

    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, 900, 300);
    gradient.addColorStop(0, '#2C2F33');
    gradient.addColorStop(1, '#23272A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 300);

    // Load and draw user avatar
    try {
      const avatar = await loadImage(
        member.user.displayAvatarURL({ size: 256 })
      );

      // Draw circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(100, 150, 64, 0, Math.PI * 2);
      ctx.fillStyle = '#23272A';
      ctx.fill();
      ctx.clip();
      ctx.drawImage(avatar, 36, 86, 128, 128);
      ctx.restore();

      // Draw avatar border circle
      ctx.strokeStyle = '#5865F2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(100, 150, 64, 0, Math.PI * 2);
      ctx.stroke();
    } catch {
      logger.warn(`Failed to load avatar for user ${member.user.id}`);
    }

    // Draw "WELCOME" text
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('WELCOME', 220, 120);

    // Draw username
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#5865F2';
    ctx.fillText(member.user.username, 220, 180);

    // Draw server info
    ctx.font = '20px Arial';
    ctx.fillStyle = '#99AAB5';
    const serverInfo = `${member.guild.name} • Member #{member.guild.memberCount}`;
    ctx.fillText(serverInfo, 220, 230);

    // Convert canvas to buffer and create attachment
    // @napi-rs/canvas uses encode(), node-canvas uses toBuffer()
    const buffer = typeof canvas.encode === 'function'
      ? await canvas.encode('png')
      : canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'welcome.png' });
  } catch (error) {
    logger.error('Failed to generate welcome image:', error);
    return null; // Graceful degradation
  }
}

/**
 * Send welcome message to configured channel
 */
export async function sendWelcomeMessage(
  member: GuildMember,
  config: WelcomeConfig
): Promise<void> {
  try {
    if (!config.welcome.enabled || !config.welcome.channelId) {
      return;
    }

    const channel = await member.guild.channels.fetch(config.welcome.channelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn(
        `Welcome channel ${config.welcome.channelId} not found or not text-based`
      );
      return;
    }

    const textChannel = channel as TextChannel;
    const attachments: AttachmentBuilder[] = [];

    // Generate welcome image if enabled
    if (config.welcome.showImage) {
      const image = await generateWelcomeImage(member);
      if (image) {
        attachments.push(image);
      }
    }

    if (config.welcome.useEmbed) {
      const container = buildWelcomeContainer(member, config.welcome);
      await textChannel.send(v2Payload([container], attachments));
    } else {
      const message = replacePlaceholders(config.welcome.message, member);
      await textChannel.send({
        content: message,
        files: attachments,
      });
    }

    logger.info(`Welcome message sent to ${member.user.tag} in ${member.guild.name}`);
  } catch (error) {
    logger.error(`Failed to send welcome message to ${member.user.tag}:`, error);
  }
}

/**
 * Send leave message to configured channel
 */
export async function sendLeaveMessage(
  member: GuildMember,
  config: WelcomeConfig
): Promise<void> {
  try {
    if (!config.leave.enabled || !config.leave.channelId) {
      return;
    }

    const channel = await member.guild.channels.fetch(config.leave.channelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn(
        `Leave channel ${config.leave.channelId} not found or not text-based`
      );
      return;
    }

    const textChannel = channel as TextChannel;

    if (config.leave.useEmbed) {
      const container = buildLeaveContainer(member, config.leave);
      await textChannel.send(v2Payload([container]));
    } else {
      const message = replacePlaceholders(config.leave.message, member);
      await textChannel.send({ content: message });
    }

    logger.info(`Leave message sent for ${member.user.tag} in ${member.guild.name}`);
  } catch (error) {
    logger.error(`Failed to send leave message for ${member.user.tag}:`, error);
  }
}

/**
 * Send welcome DM to member
 */
export async function sendWelcomeDm(
  member: GuildMember,
  config: WelcomeConfig
): Promise<void> {
  try {
    if (!config.dm.enabled) {
      return;
    }

    if (config.dm.useEmbed) {
      const container = buildDmContainer(member, config.dm);
      await member.send(v2Payload([container]));
    } else {
      const message = replacePlaceholders(config.dm.message, member);
      await member.send({ content: message });
    }

    logger.info(`Welcome DM sent to ${member.user.tag}`);
  } catch (error) {
    logger.warn(
      `Failed to send welcome DM to ${member.user.tag} (likely DMs disabled):`,
      error
    );
  }
}

/**
 * Assign autoroles to member
 * Handles both regular roles and bot roles with optional delay
 */
export async function assignAutoroles(
  member: GuildMember,
  config: WelcomeConfig
): Promise<void> {
  try {
    if (!config.autorole.enabled) {
      return;
    }

    // Determine which roles to assign (bot roles for bots, regular roles otherwise)
    const rolesToAssign = member.user.bot
      ? config.autorole.botRoles
      : config.autorole.roles;

    if (rolesToAssign.length === 0) {
      return;
    }

    const delaySeconds = config.autorole.delaySeconds || 0;

    if (delaySeconds > 0) {
      // Store timeout in cache for persistence
      const timeoutKey = `autorole:${member.guild.id}:${member.id}`;

      // Set timeout
      const timeoutId = setTimeout(async () => {
        await assignRolesToMember(member, rolesToAssign);
      }, delaySeconds * 1000);

      // Store in cache (for recovery on bot restart)
      await cache.set(timeoutKey, timeoutId.toString(), delaySeconds);

      logger.info(
        `Scheduled autorole assignment for ${member.user.tag} in ${member.guild.name} (${delaySeconds}s delay)`
      );
    } else {
      // Assign immediately
      await assignRolesToMember(member, rolesToAssign);
    }
  } catch (error) {
    logger.error(
      `Failed to assign autoroles to ${member.user.tag}:`,
      error
    );
  }
}

/**
 * Helper function to assign roles to a member
 */
async function assignRolesToMember(
  member: GuildMember,
  roleIds: string[]
): Promise<void> {
  for (const roleId of roleIds) {
    try {
      const role = await member.guild.roles.fetch(roleId);
      if (!role) {
        logger.warn(`Role ${roleId} not found in guild ${member.guild.id}`);
        continue;
      }

      await member.roles.add(role);
      logger.info(
        `Assigned role ${role.name} to ${member.user.tag} in ${member.guild.name}`
      );
    } catch (error) {
      logger.error(`Failed to assign role ${roleId} to ${member.user.tag}:`, error);
    }
  }
}

/**
 * Check account age against join gate rules
 * Returns true if member passes gate, false if gated
 */
export async function checkJoinGate(
  member: GuildMember,
  config: WelcomeConfig
): Promise<boolean> {
  try {
    if (!config.joingate.enabled) {
      return true; // Pass if disabled
    }

    // Calculate account age in days
    const createdAt = member.user.createdAt;
    const now = new Date();
    const ageInMs = now.getTime() - createdAt.getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    // Check if account is old enough
    if (ageInDays >= config.joingate.minAccountAgeDays) {
      return true; // Account is old enough, pass
    }

    // Account is too young - take action
    const action = config.joingate.action;

    if (action === 'kick') {
      await member.kick(
        `Account too young (${Math.floor(ageInDays)} days old, minimum ${config.joingate.minAccountAgeDays} required)`
      );
      logger.info(`Kicked ${member.user.tag} for account age (${Math.floor(ageInDays)} days)`);

      if (config.joingate.logKicks) {
        // Log to configured channel if available
        if (config.joingate.verifyChannelId) {
          try {
            const logChannel = await member.guild.channels.fetch(
              config.joingate.verifyChannelId
            );
            if (logChannel?.isTextBased()) {
              await (logChannel as TextChannel).send({
                content: `\`Kicked\` ${member.user.tag} (account age: ${Math.floor(ageInDays)} days)`,
              });
            }
          } catch (err) {
            logger.warn('Failed to log kick to verify channel:', err);
          }
        }
      }
    } else if (action === 'quarantine') {
      // Clear all roles and optionally assign quarantine role
      try {
        await member.roles.remove('Account too young - under verification');
        logger.info(
          `Quarantined ${member.user.tag} (account age: ${Math.floor(ageInDays)} days)`
        );
      } catch (err) {
        logger.error(`Failed to quarantine ${member.user.tag}:`, err);
      }
    }

    return false; // Account gated
  } catch (error) {
    logger.error(`Failed to check join gate for ${member.user.tag}:`, error);
    return true; // Pass on error (fail-safe)
  }
}

/**
 * Mark that a member has been greeted in a channel
 * Uses Redis SETNX for atomicity
 * Returns true if this is the first time they've been greeted
 */
export async function markFirstMessage(
  guildId: string,
  userId: string
): Promise<boolean> {
  try {
    const key = `welcome:greeted:${guildId}:${userId}`;

    // Check if key already exists (was this user greeted before?)
    const exists = await cache.has(key);

    if (exists) {
      return false; // Not first time
    }

    // Set the key with expiry of 30 days
    await cache.set(key, '1', 30 * 24 * 60 * 60);

    return true; // First time
  } catch (error) {
    logger.error(`Failed to mark first message for user ${userId}:`, error);
    return false; // Return false on error (conservative approach)
  }
}
