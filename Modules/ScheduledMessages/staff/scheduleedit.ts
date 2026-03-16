import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import { isValidCron, buildEmbed, parseSimpleInterval } from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('scheduleedit')
    .setDescription('Edit a scheduled message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID of the scheduled message to edit')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('New channel to send the message to')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('New plain text message content')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('embed')
        .setDescription('New embed data (JSON)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('datetime')
        .setDescription('New datetime for one-time messages (ISO format or relative)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('cron')
        .setDescription('New cron expression for recurring messages')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('interval')
        .setDescription('New simple interval for recurring messages')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('active')
        .setDescription('Enable or disable the scheduled message')
        .setRequired(false)
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.scheduleedit',
  defaultPermissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const id = interaction.options.getString('id', true);
      const newChannel = interaction.options.getChannel('channel');
      const newMessage = interaction.options.getString('message');
      const newEmbed = interaction.options.getString('embed');
      const newDatetime = interaction.options.getString('datetime');
      const newCron = interaction.options.getString('cron');
      const newInterval = interaction.options.getString('interval');
      const newActive = interaction.options.getBoolean('active');

      const guildId = interaction.guildId!;
      const db = (interaction.client as any).db;

      if (!db) {
        return await interaction.editReply('❌ Database not available.');
      }

      // Fetch the scheduled message
      const result = await db.query(
        'SELECT * FROM scheduledMessages WHERE id = $1 AND guildId = $2',
        [id, guildId]
      );

      if (!result.rows || result.rows.length === 0) {
        return await interaction.editReply('❌ Scheduled message not found.');
      }

      const message = result.rows[0];

      // Build updates
      const updates: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (newChannel) {
        updates.push(`channelId = $${paramIndex++}`);
        updateParams.push(newChannel.id);
      }

      if (newMessage !== null) {
        updates.push(`content = $${paramIndex++}`);
        updateParams.push(newMessage || null);
      }

      if (newEmbed !== null) {
        try {
          const embedData = JSON.parse(newEmbed);
          buildEmbed(embedData);
          updates.push(`embedData = $${paramIndex++}`);
          updateParams.push(JSON.stringify(embedData));
        } catch (error) {
          return await interaction.editReply('❌ Invalid embed JSON format.');
        }
      }

      if (newDatetime && !message.isRecurring) {
        const scheduledFor = parseDateTime(newDatetime);
        if (!scheduledFor) {
          return await interaction.editReply(
            '❌ Invalid datetime format. Use ISO format (2025-12-31T15:30) or relative (1h, 30m, 2d).'
          );
        }
        if (scheduledFor <= new Date()) {
          return await interaction.editReply('❌ Scheduled time must be in the future.');
        }
        updates.push(`scheduledFor = $${paramIndex++}`);
        updateParams.push(scheduledFor);
      }

      if (newCron && message.isRecurring) {
        if (!isValidCron(newCron)) {
          return await interaction.editReply('❌ Invalid cron expression.');
        }
        updates.push(`cronExpression = $${paramIndex++}`);
        updateParams.push(newCron);
      }

      if (newInterval && message.isRecurring) {
        const parsed = parseSimpleInterval(newInterval);
        if (!parsed) {
          return await interaction.editReply('❌ Invalid interval format.');
        }
        updates.push(`cronExpression = $${paramIndex++}`);
        updateParams.push(parsed);
      }

      if (newActive !== null) {
        updates.push(`isActive = $${paramIndex++}`);
        updateParams.push(newActive);
      }

      if (updates.length === 0) {
        return await interaction.editReply('❌ No updates provided.');
      }

      updateParams.push(id);
      updateParams.push(guildId);

      // Execute update
      await db.query(
        `UPDATE scheduledMessages SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND guildId = $${paramIndex++}`,
        updateParams
      );

      const container = moduleContainer('scheduled_messages');
      container.setAccentColor(0x00aa00);
      addText(container, '### Scheduled Message Updated');
      addText(container, `**Message ID**\n\`${id}\``);
      addText(container, `**Updates**\n${updates.length.toString()}`);
      addFooter(container, 'Use /schedulelist to view all scheduled messages');

      await interaction.editReply(v2Payload([container]));

      logger.info(`[ScheduledMessages] Edited scheduled message ${id} in guild ${guildId}`);
    } catch (error) {
      logger.error('[ScheduledMessages] Error in scheduleedit command:', error);
      await interaction.editReply({ content: '❌ An error occurred while editing the scheduled message.' });
    }
  },
};

function parseDateTime(input: string): Date | null {
  if (input.includes('T')) {
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

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

export default command;
