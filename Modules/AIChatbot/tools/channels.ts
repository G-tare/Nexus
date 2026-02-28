/**
 * Channel Management Tools — 8 tools for creating, editing, deleting, and
 * organizing channels and categories.
 */

import { ChannelType, PermissionFlagsBits, OverwriteType, CategoryChannel, GuildChannelTypes } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';

export const channelTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. create_channel
  // ─────────────────────────────
  {
    id: 'channels.create',
    category: 'channels',
    name: 'Create Channel',
    description: 'Create a new text or voice channel in the server. Optionally place it inside a category.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Channel name (auto-lowercased, spaces become hyphens for text channels)' },
        type: { type: 'string', description: 'Channel type', enum: ['text', 'voice', 'announcement', 'stage', 'forum'] },
        category_name: { type: 'string', description: 'Name of the category to place this channel in (optional). If it does not exist, it will NOT be created — use create_category first.' },
        topic: { type: 'string', description: 'Channel topic / description (text channels only, optional)' },
        nsfw: { type: 'string', description: 'Whether the channel is NSFW', enum: ['true', 'false'] },
      },
      required: ['name', 'type'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = params.name as string;
      const typeStr = (params.type as string) || 'text';
      const categoryName = params.category_name as string | undefined;
      const topic = params.topic as string | undefined;
      const nsfw = params.nsfw === 'true';

      const typeMap: Record<string, GuildChannelTypes> = {
        text: ChannelType.GuildText,
        voice: ChannelType.GuildVoice,
        announcement: ChannelType.GuildAnnouncement,
        stage: ChannelType.GuildStageVoice,
        forum: ChannelType.GuildForum,
      };

      const channelType = (typeMap[typeStr] ?? ChannelType.GuildText) as GuildChannelTypes;

      // Find category if specified
      let parent: CategoryChannel | undefined;
      if (categoryName) {
        const found = ctx.guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === categoryName.toLowerCase(),
        );
        if (found) parent = found as CategoryChannel;
        else return `Error: Category "${categoryName}" not found. Use channels.create_category to create it first. Available categories: ${ctx.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory).map(ch => ch.name).join(', ') || 'none'}`;
      }

      const channel = await ctx.guild.channels.create({
        name,
        type: channelType,
        parent: parent?.id,
        topic: topic ?? undefined,
        nsfw,
      });

      return `Created ${typeStr} channel #${channel.name} (ID: ${channel.id})${parent ? ` in category "${parent.name}"` : ''}.`;
    },
  },

  // ─────────────────────────────
  // 2. delete_channel
  // ─────────────────────────────
  {
    id: 'channels.delete',
    category: 'channels',
    name: 'Delete Channel',
    description: 'Delete a channel from the server. This is IRREVERSIBLE.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel to delete (e.g. "general")' },
      },
      required: ['channel_name'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const channel = ctx.guild.channels.cache.find(ch => ch.name.toLowerCase() === name && ch.type !== ChannelType.GuildCategory);

      if (!channel) {
        return `Error: Channel "${name}" not found. Available channels: ${ctx.guild.channels.cache.filter(ch => ch.type !== ChannelType.GuildCategory).map(ch => ch.name).join(', ')}`;
      }

      const channelName = channel.name;
      await channel.delete();
      return `Deleted channel #${channelName}.`;
    },
  },

  // ─────────────────────────────
  // 3. edit_channel
  // ─────────────────────────────
  {
    id: 'channels.edit',
    category: 'channels',
    name: 'Edit Channel',
    description: 'Edit a channel\'s name, topic, slowmode, or NSFW setting.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Current name of the channel to edit' },
        new_name: { type: 'string', description: 'New name for the channel (optional)' },
        topic: { type: 'string', description: 'New topic (optional)' },
        slowmode: { type: 'string', description: 'Slowmode delay in seconds (0 to disable, optional)' },
        nsfw: { type: 'string', description: 'NSFW toggle', enum: ['true', 'false'] },
      },
      required: ['channel_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const channel = ctx.guild.channels.cache.find(ch => ch.name.toLowerCase() === name);

      if (!channel) {
        return `Error: Channel "${name}" not found.`;
      }

      const updates: Record<string, unknown> = {};
      if (params.new_name) updates.name = params.new_name as string;
      if (params.topic !== undefined) updates.topic = params.topic as string;
      if (params.slowmode !== undefined) updates.rateLimitPerUser = parseInt(params.slowmode as string, 10);
      if (params.nsfw !== undefined) updates.nsfw = params.nsfw === 'true';

      if (Object.keys(updates).length === 0) {
        return 'No changes specified.';
      }

      await channel.edit(updates);
      const changes = Object.keys(updates).join(', ');
      return `Updated #${channel.name}: changed ${changes}.`;
    },
  },

  // ─────────────────────────────
  // 4. move_channel
  // ─────────────────────────────
  {
    id: 'channels.move',
    category: 'channels',
    name: 'Move Channel',
    description: 'Move a channel to a different category or change its position.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel to move' },
        category_name: { type: 'string', description: 'Name of the target category (use "none" to remove from category)' },
        position: { type: 'string', description: 'New position number within the category (optional)' },
      },
      required: ['channel_name', 'category_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const categoryName = (params.category_name as string).toLowerCase();
      const position = params.position ? parseInt(params.position as string, 10) : undefined;

      const channel = ctx.guild.channels.cache.find(ch => ch.name.toLowerCase() === channelName && ch.type !== ChannelType.GuildCategory);
      if (!channel) return `Error: Channel "${channelName}" not found.`;

      if (categoryName === 'none') {
        await channel.edit({ parent: null });
        return `Moved #${channel.name} out of its category.`;
      }

      const category = ctx.guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === categoryName,
      );
      if (!category) return `Error: Category "${categoryName}" not found.`;

      const updates: Record<string, unknown> = { parent: category.id };
      if (position !== undefined) updates.position = position;

      await channel.edit(updates);
      return `Moved #${channel.name} to category "${category.name}"${position !== undefined ? ` at position ${position}` : ''}.`;
    },
  },

  // ─────────────────────────────
  // 5. create_category
  // ─────────────────────────────
  {
    id: 'channels.create_category',
    category: 'channels',
    name: 'Create Category',
    description: 'Create a new channel category to organize channels into groups.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name' },
        position: { type: 'string', description: 'Position in the channel list (optional)' },
      },
      required: ['name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = params.name as string;
      const position = params.position ? parseInt(params.position as string, 10) : undefined;

      const category = await ctx.guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        position,
      });

      return `Created category "${category.name}" (ID: ${category.id}).`;
    },
  },

  // ─────────────────────────────
  // 6. delete_category
  // ─────────────────────────────
  {
    id: 'channels.delete_category',
    category: 'channels',
    name: 'Delete Category',
    description: 'Delete a channel category. Channels inside it will become uncategorized (not deleted).',
    parameters: {
      type: 'object',
      properties: {
        category_name: { type: 'string', description: 'Name of the category to delete' },
      },
      required: ['category_name'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = (params.category_name as string).toLowerCase();
      const category = ctx.guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === name,
      );

      if (!category) return `Error: Category "${name}" not found.`;

      const catName = category.name;
      await category.delete();
      return `Deleted category "${catName}". Any channels inside are now uncategorized.`;
    },
  },

  // ─────────────────────────────
  // 7. list_channels
  // ─────────────────────────────
  {
    id: 'channels.list',
    category: 'channels',
    name: 'List Channels',
    description: 'List all channels in the server, organized by category. Use this to understand the server structure before making changes.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      const channels = ctx.guild.channels.cache;
      const categories = channels.filter(ch => ch.type === ChannelType.GuildCategory).sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0));
      const uncategorized = channels.filter(ch => !ch.parentId && ch.type !== ChannelType.GuildCategory);

      const lines: string[] = [];

      for (const cat of categories.values()) {
        lines.push(`📁 ${cat.name}`);
        const children = channels.filter(ch => ch.parentId === cat.id).sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0));
        for (const child of children.values()) {
          const icon = child.type === ChannelType.GuildVoice || child.type === ChannelType.GuildStageVoice ? '🔊' : '#';
          lines.push(`  ${icon} ${child.name}`);
        }
      }

      if (uncategorized.size > 0) {
        lines.push(`📁 (No Category)`);
        for (const ch of uncategorized.values()) {
          const icon = ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice ? '🔊' : '#';
          lines.push(`  ${icon} ${ch.name}`);
        }
      }

      return `Server Channels (${channels.size} total):\n${lines.join('\n')}`;
    },
  },

  // ─────────────────────────────
  // 8. set_channel_topic
  // ─────────────────────────────
  {
    id: 'channels.set_topic',
    category: 'channels',
    name: 'Set Channel Topic',
    description: 'Set or update the topic/description of a text channel.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel' },
        topic: { type: 'string', description: 'New topic text (empty string to clear)' },
      },
      required: ['channel_name', 'topic'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const name = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const topic = params.topic as string;

      const channel = ctx.guild.channels.cache.find(ch => ch.name.toLowerCase() === name);
      if (!channel) return `Error: Channel "${name}" not found.`;

      await channel.edit({ topic });
      return `Updated #${channel.name} topic to: "${topic || '(cleared)'}"`;
    },
  },
];
