import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import {
  isValidCron,
  getNextFireTime,
  embedToJSON,
  buildEmbed,
  parseSimpleInterval,
  formatCron,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Create a scheduled message to be sent at a specific time or recurring')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to send the message to')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Message type: one-time or recurring')
        .setRequired(true)
        .addChoices({ name: 'One-time', value: 'once' }, { name: 'Recurring', value: 'recurring' })
    )
    .addStringOption((option) =>
      option
        .setName('datetime')
        .setDescription('For one-time: ISO date (2025-12-31T15:30) or relative (1h, 30m, 2d). Required for one-time')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('cron')
        .setDescription('For recurring: cron expression (min hour day month dow) e.g., "0 9 * * 1" for 9am Mondays')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('interval')
        .setDescription('For recurring: simple interval e.g., "2h", "30m", "1d". Alternative to cron')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('Plain text message content').setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('embed')
        .setDescription('JSON embed data (embed builder format)')
        .setRequired(false)
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.schedule',
  defaultPermissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const channel = interaction.options.getChannel('channel', true);
      const type = interaction.options.getString('type', true);
      const datetime = interaction.options.getString('datetime');
      const cron = interaction.options.getString('cron');
      const interval = interaction.options.getString('interval');
      const message = interaction.options.getString('message');
      const embedJson = interaction.options.getString('embed');

      // Validation
      if (!message && !embedJson) {
        return await interaction.editReply('❌ You must provide either a message or embed data.');
      }

      const guildId = interaction.guildId!;
      const db = (interaction.client as any).db;

      if (!db) {
        return await interaction.editReply('❌ Database not available.');
      }

      // Check guild limit
      const config = await db.query(
        'SELECT maxScheduledPerGuild FROM scheduledMessagesConfig WHERE guildId = $1',
        [guildId]
      );

      const limit = config.rows?.[0]?.maxScheduledPerGuild ?? 25;
      const existing = await db.query(
        'SELECT COUNT(*) as count FROM scheduledMessages WHERE guildId = $1 AND isActive = true',
        [guildId]
      );

      if (parseInt(existing.rows[0].count) >= limit) {
        return await interaction.editReply(
          `❌ Guild limit reached (${limit} active scheduled messages). Delete some first.`
        );
      }

      let scheduledFor: Date | null = null;
      let cronExpression: string | null = null;
      let isRecurring = false;

      // Parse scheduling info
      if (type === 'once') {
        if (!datetime) {
          return await interaction.editReply('❌ For one-time messages, you must provide a datetime.');
        }

        // Try to parse datetime
        scheduledFor = parseDateTime(datetime);
        if (!scheduledFor) {
          return await interaction.editReply(
            '❌ Invalid datetime format. Use ISO format (2025-12-31T15:30) or relative (1h, 30m, 2d).'
          );
        }

        if (scheduledFor <= new Date()) {
          return await interaction.editReply('❌ Scheduled time must be in the future.');
        }
      } else if (type === 'recurring') {
        isRecurring = true;

        if (cron) {
          if (!isValidCron(cron)) {
            return await interaction.editReply(
              '❌ Invalid cron expression. Format: minute hour day month dayOfWeek (e.g., "0 9 * * 1")'
            );
          }
          cronExpression = cron;
        } else if (interval) {
          const parsed = parseSimpleInterval(interval);
          if (!parsed) {
            return await interaction.editReply(
              '❌ Invalid interval. Use format like "2h", "30m", "1d".'
            );
          }
          cronExpression = parsed;
        } else {
          return await interaction.editReply('❌ For recurring messages, provide either a cron expression or interval.');
        }
      }

      // Parse embed data if provided
      let embedData = null;
      if (embedJson) {
        try {
          embedData = JSON.parse(embedJson);
          // Validate it can be used to build an embed
          buildEmbed(embedData);
        } catch (error) {
          return await interaction.editReply('❌ Invalid embed JSON format.');
        }
      }

      // Insert into database
      const id = generateId();
      await db.query(
        `INSERT INTO scheduledMessages 
         (id, guildId, channelId, creatorId, content, embedData, scheduledFor, cronExpression, isRecurring, isActive, createdAt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())`,
        [
          id,
          guildId,
          channel.id,
          interaction.user.id,
          message || null,
          embedData ? JSON.stringify(embedData) : null,
          scheduledFor,
          cronExpression,
          isRecurring,
        ]
      );

      // Build response embed
      const responseEmbed = new EmbedBuilder()
        .setColor('#00aa00')
        .setTitle('Scheduled Message Created')
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Type', value: isRecurring ? 'Recurring' : 'One-time', inline: true },
          {
            name: 'Schedule',
            value: isRecurring
              ? `\`${cronExpression || 'invalid'}\`` + (interval ? ` (${interval})` : '')
              : scheduledFor
                ? `<t:${Math.floor(scheduledFor.getTime() / 1000)}:F>`
                : 'Not set',
            inline: false,
          },
          {
            name: 'Content',
            value: message ? message.substring(0, 100) : (embedData ? '(Embed)' : 'None'),
            inline: true,
          },
          { name: 'Message ID', value: `\`${id}\``, inline: true }
        )
        .setFooter({ text: 'Use /schedulelist to view all scheduled messages' });

      await interaction.editReply({ embeds: [responseEmbed] });

      logger.info(
        `[ScheduledMessages] Created scheduled message ${id} for guild ${guildId}, channel ${channel.id}`
      );
    } catch (error) {
      logger.error('[ScheduledMessages] Error in schedule command:', error);
      await interaction.editReply({ content: '❌ An error occurred while creating the scheduled message.' });
    }
  },
};

function parseDateTime(input: string): Date | null {
  // ISO format: 2025-12-31T15:30
  if (input.includes('T')) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Relative format: 1h, 30m, 2d
  const match = input.toLowerCase().match(/^(\d+)([smhd])$/);
  if (match) {
    const [, value, unit] = match;
    const num = parseInt(value);
    const now = new Date();

    switch (unit) {
      case 's':
        return new Date(now.getTime() + num * 1000);
      case 'm':
        return new Date(now.getTime() + num * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + num * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + num * 24 * 60 * 60 * 1000);
    }
  }

  return null;
}

function generateId(): string {
  return `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default command;
