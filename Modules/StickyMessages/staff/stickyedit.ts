import {  SlashCommandBuilder, PermissionFlagsBits, TextChannel, MessageFlags } from 'discord.js';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('StickyMessages');
import { StickyMessagesHelper } from '../helpers';
import type { BotCommand } from '../../../Shared/src/types/command';


const stickyeditCommand: BotCommand = {
  module: 'stickymessages',
  permissionPath: 'staff.stickymessages.edit',
  data: new SlashCommandBuilder()
    .setName('stickyedit')
    .setDescription('Edit an existing sticky message')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel containing the sticky')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('index')
        .setDescription('Which sticky to edit (1 = highest priority)')
        .setMinValue(1)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('New message content')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('interval')
        .setDescription('New re-stick interval')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('priority')
        .setDescription('New priority')
        .setMinValue(0)
        .setMaxValue(999)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any, db: any) {
    try {
      await interaction.deferReply();

      const channel = interaction.options.getChannel('channel', true);
      const index = (interaction.options.getInteger('index') || 1) - 1;
      const newContent = interaction.options.getString('content');
      const newInterval = interaction.options.getInteger('interval');
      const newPriority = interaction.options.getInteger('priority');

      // Get stickies in this channel
      const helper = new StickyMessagesHelper(db);
      const stickies = await helper.getStickyMessagesByChannel(channel.id);

      if (stickies.length === 0) {
        await interaction.editReply({
          content: 'There are no sticky messages in that channel.',
        });
        return;
      }

      if (index < 0 || index >= stickies.length) {
        await interaction.editReply({
          content: `Invalid index. There are only ${stickies.length} sticky message(s).`,
        });
        return;
      }

      // Check if at least one field is being updated
      if (!newContent && newInterval === null && newPriority === null) {
        await interaction.editReply({
          content: 'Please specify at least one field to edit.',
        });
        return;
      }

      const sticky = stickies[index];

      // Update the sticky
      const updates: any = {};
      if (newContent !== null) updates.content = newContent;
      if (newInterval !== null) updates.interval = newInterval;
      if (newPriority !== null) updates.priority = newPriority;

      const updated = await helper.updateStickyMessage(sticky.id, updates);

      // If content changed and sticky has a message, update it
      if (newContent && sticky.currentMessageId && channel.isTextBased()) {
        try {
          const message = await (channel as TextChannel).messages.fetch(
            sticky.currentMessageId
          );
          await message.edit({ content: newContent });
          logger.debug(`Updated sticky message ${sticky.currentMessageId}`);
        } catch (error) {
          logger.debug(`Failed to update sticky message: ${error}`);
          // Reset the message ID to force a resend
          await helper.updateStickyMessage(sticky.id, {
            currentMessageId: null,
            messagesSince: 0,
          });
        }
      }

      logger.info(
        `Edited sticky message ${sticky.id} in channel ${channel.id}`
      );

      const changes = [];
      if (newContent) changes.push(`Content updated`);
      if (newInterval) changes.push(`Interval changed to ${newInterval}`);
      if (newPriority !== null) changes.push(`Priority changed to ${newPriority}`);

      await interaction.editReply({
        content: `Sticky message updated: ${changes.join(', ')}`,
      });

      // Emit audit log event
      if (interaction.client.emit) {
        interaction.client.emit('auditLog', {
          type: 'STICKY_EDITED',
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          details: {
            stickyId: sticky.id,
            channelId: channel.id,
            changes: updates,
          },
        });
      }
    } catch (error) {
      logger.error(`Error in stickyedit command: ${error}`);
      await interaction.editReply({
        content: 'An error occurred while editing the sticky message.',
      });
    }
  },
};

export default stickyeditCommand;
