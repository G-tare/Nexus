/**
 * Message Management Tools — 4 tools for sending, deleting, and pinning messages.
 */

import { ChannelType, PermissionFlagsBits, TextChannel, ColorResolvable, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';

export const messageTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. send_message
  // ─────────────────────────────
  {
    id: 'messages.send',
    category: 'messages',
    name: 'Send Message',
    description: 'Send a text message to a specific channel.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel to send to' },
        content: { type: 'string', description: 'Message content (up to 2000 characters)' },
      },
      required: ['channel_name', 'content'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.SendMessages,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const content = params.content as string;

      const channel = ctx.guild.channels.cache.find(
        ch => ch.name.toLowerCase() === channelName && ch.isTextBased() && !ch.isDMBased(),
      );
      if (!channel || !channel.isTextBased()) {
        return `Error: Text channel "${channelName}" not found.`;
      }

      if (content.length > 2000) {
        return 'Error: Message content exceeds 2000 characters.';
      }

      const msg = await (channel as TextChannel).send(content);
      return `Message sent to #${channel.name} (message ID: ${msg.id}).`;
    },
  },

  // ─────────────────────────────
  // 2. send_embed
  // ─────────────────────────────
  {
    id: 'messages.send_embed',
    category: 'messages',
    name: 'Send Embed',
    description: 'Send a rich embed message to a channel. Great for announcements, rules, welcome messages, etc.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel to send to' },
        title: { type: 'string', description: 'Embed title' },
        description: { type: 'string', description: 'Embed body text (supports Discord markdown)' },
        color: { type: 'string', description: 'Color name (red, blue, green) or hex (#ff0000)' },
        footer: { type: 'string', description: 'Footer text (optional)' },
        thumbnail_url: { type: 'string', description: 'Thumbnail image URL (optional)' },
        image_url: { type: 'string', description: 'Large image URL (optional)' },
      },
      required: ['channel_name', 'title', 'description'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.SendMessages,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const channel = ctx.guild.channels.cache.find(
        ch => ch.name.toLowerCase() === channelName && ch.isTextBased() && !ch.isDMBased(),
      );
      if (!channel || !channel.isTextBased()) {
        return `Error: Text channel "${channelName}" not found.`;
      }

      const container = new ContainerBuilder();
      const title = params.title as string;
      const description = params.description as string;

      if (params.color) {
        const colorStr = (params.color as string).toLowerCase();
        const namedColors: Record<string, number> = {
          red: 0xE74C3C, blue: 0x3498DB, green: 0x2ECC71, yellow: 0xF1C40F,
          orange: 0xE67E22, purple: 0x9B59B6, pink: 0xE91E63, white: 0xFFFFFF,
          black: 0x000000, gray: 0x95A5A6, cyan: 0x1ABC9C, gold: 0xF1C40F,
        };
        const color = namedColors[colorStr] ?? (colorStr.startsWith('#') ? parseInt(colorStr.slice(1), 16) : 0x3498DB);
        container.setAccentColor(color);
      }

      const textContent = title ? `### ${title}\n${description}` : description;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));

      if (params.footer) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${params.footer as string}`));
      }

      const msg = await (channel as TextChannel).send({ components: [container], flags: 1 << 20 });
      return `Embed sent to #${channel.name} (message ID: ${msg.id}).`;
    },
  },

  // ─────────────────────────────
  // 3. pin_message
  // ─────────────────────────────
  {
    id: 'messages.pin',
    category: 'messages',
    name: 'Pin Message',
    description: 'Pin a message by its ID in a channel.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel' },
        message_id: { type: 'string', description: 'ID of the message to pin' },
      },
      required: ['channel_name', 'message_id'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageMessages,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const messageId = params.message_id as string;

      const channel = ctx.guild.channels.cache.find(
        ch => ch.name.toLowerCase() === channelName && ch.isTextBased(),
      );
      if (!channel || !channel.isTextBased()) {
        return `Error: Text channel "${channelName}" not found.`;
      }

      try {
        const msg = await (channel as TextChannel).messages.fetch(messageId);
        await msg.pin();
        return `Pinned message ${messageId} in #${channel.name}.`;
      } catch {
        return `Error: Message "${messageId}" not found in #${channel.name}.`;
      }
    },
  },

  // ─────────────────────────────
  // 4. delete_messages
  // ─────────────────────────────
  {
    id: 'messages.delete',
    category: 'messages',
    name: 'Delete Messages',
    description: 'Bulk-delete recent messages from a channel. Max 100, messages must be less than 14 days old.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel' },
        count: { type: 'string', description: 'Number of messages to delete (1-100)' },
      },
      required: ['channel_name', 'count'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageMessages,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const count = Math.min(100, Math.max(1, parseInt(params.count as string, 10) || 1));

      const channel = ctx.guild.channels.cache.find(
        ch => ch.name.toLowerCase() === channelName && ch.isTextBased(),
      );
      if (!channel || !channel.isTextBased()) {
        return `Error: Text channel "${channelName}" not found.`;
      }

      const deleted = await (channel as TextChannel).bulkDelete(count, true);
      return `Deleted ${deleted.size} messages from #${channel.name}.`;
    },
  },
];
