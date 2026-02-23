import {
  Client,
  Events,
  GuildMember,
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  Message,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getColorPalette,
  getColorConfig,
  assignColor,
  removeColor,
  emojiToIndex,
  getReactionLists,
} from './helpers';
import { sql } from 'drizzle-orm';

const logger = createModuleLogger('ColorRoles:Events');

// ============================================
// Reaction Add — Assign Color Role
// ============================================

const reactionAddHandler: ModuleEvent = { event: Events.MessageReactionAdd,
  async handler(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    // Ensure full reaction data
    if (reaction.partial) {
      try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (!reaction.message.guild) return;

    const guild = reaction.message.guild;
    const messageId = reaction.message.id;

    // Check if this is a reaction color list message
    const reactionLists = await getReactionLists(guild.id);
    const list = reactionLists.find(l => l.messageId === messageId);
    if (!list) return;

    // Get the color index from the emoji
    const emojiName = reaction.emoji.name || '';
    const index = emojiToIndex(emojiName);
    if (index < 0) return;

    // Get the colors in this list
    const allColors = await getColorPalette(guild.id);
    const listColors = allColors.filter(c => list.colorIds.includes(c.id));
    if (index >= listColors.length) return;

    const color = listColors[index];

    // Check whitelist
    const config = await getColorConfig(guild.id);
    if (config.whitelistEnabled) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member && !config.whitelistRoleIds.some(roleId => member.roles.cache.has(roleId))) {
        // Remove the reaction silently
        try { await reaction.users.remove(user.id); } catch { /* no perms */ }
        return;
      }
    }

    // Assign the color
    try {
      await assignColor(guild, user.id, color.id);

      if (config.reactionMessages) {
        // Send ephemeral-like DM or do nothing (Discord doesn't support ephemeral on reactions)
        // We can DM the user if reaction messages are enabled
        try {
          const fullUser = await guild.client.users.fetch(user.id);
          await fullUser.send({
            content: `🎨 Your color in **${guild.name}** has been set to **${color.name}** (\`#${color.hex}\`)!`,
          });
        } catch { /* DMs disabled */ }
      }

      logger.debug('Color assigned via reaction', {
        guildId: guild.id,
        userId: user.id,
        color: color.name,
      });
    } catch (err: any) {
      logger.error('Failed to assign color via reaction', { error: err.message });
    }
  },
};

// ============================================
// Reaction Remove — Remove Color Role
// ============================================

const reactionRemoveHandler: ModuleEvent = { event: Events.MessageReactionRemove,
  async handler(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
      try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (!reaction.message.guild) return;

    const guild = reaction.message.guild;
    const messageId = reaction.message.id;

    // Check if this is a reaction color list message
    const reactionLists = await getReactionLists(guild.id);
    const list = reactionLists.find(l => l.messageId === messageId);
    if (!list) return;

    // Get the color index from the emoji
    const emojiName = reaction.emoji.name || '';
    const index = emojiToIndex(emojiName);
    if (index < 0) return;

    // Get the colors in this list
    const allColors = await getColorPalette(guild.id);
    const listColors = allColors.filter(c => list.colorIds.includes(c.id));
    if (index >= listColors.length) return;

    const color = listColors[index];

    // Check if user has this specific color role, and remove it
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    if (member.roles.cache.has(color.roleId)) {
      try {
        await member.roles.remove(color.roleId, 'Color removed via reaction');
        logger.debug('Color removed via reaction', {
          guildId: guild.id,
          userId: user.id,
          color: color.name,
        });
      } catch (err: any) {
        logger.error('Failed to remove color via reaction', { error: err.message });
      }
    }
  },
};

// ============================================
// Member Join — Auto-assign Color
// ============================================

const memberJoinHandler: ModuleEvent = { event: Events.GuildMemberAdd,
  async handler(member: GuildMember) {
    const config = await getColorConfig(member.guild.id);
    if (!config.joinColor) return;

    const colors = await getColorPalette(member.guild.id);
    if (colors.length === 0) return;

    let colorId: number;

    if (config.joinColor === 'random') {
      // Pick a random color
      const randomIndex = Math.floor(Math.random() * colors.length);
      colorId = colors[randomIndex].id;
    } else {
      // Specific color ID
      const color = colors.find(c => c.id === config.joinColor);
      if (!color) return;
      colorId = color.id;
    }

    try {
      await assignColor(member.guild, member.id, colorId);
      logger.debug('Auto-assigned join color', {
        guildId: member.guild.id,
        userId: member.id,
        colorId,
      });
    } catch (err: any) {
      logger.error('Failed to auto-assign join color', { error: err.message });
    }
  },
};

// ============================================
// Member Leave — Cleanup (optional)
// ============================================

const memberLeaveHandler: ModuleEvent = { event: Events.GuildMemberRemove,
  async handler(member: GuildMember) {
    // Color roles are automatically removed when the member leaves
    // since Discord removes all roles on leave. No cleanup needed.
    // But we can log it for tracking purposes.
    logger.debug('Member left, color roles auto-removed by Discord', {
      guildId: member.guild.id,
      userId: member.id,
    });
  },
};

// ============================================
// Message Delete — Clean up reaction lists
// ============================================

const messageDeleteHandler: ModuleEvent = { event: Events.MessageDelete,
  async handler(message: Message) {
    if (!message.guild) return;

    const db = getDb();

    // Check if this was a reaction color list message and clean up the DB record
    try {
      await db.execute(sql`
        DELETE FROM color_reaction_lists
        WHERE guild_id = ${message.guild.id} AND message_id = ${message.id}
      `);
    } catch { /* ignore */ }
  },
};

export const colorRolesEvents: ModuleEvent[] = [
  reactionAddHandler,
  reactionRemoveHandler,
  memberJoinHandler,
  memberLeaveHandler,
  messageDeleteHandler,
];
