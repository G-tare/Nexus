import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
  APIEmbed, MessageFlags } from 'discord.js';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('StickyMessages');
import { StickyMessagesHelper } from '../helpers';
import type { BotCommand } from '../../../Shared/src/types/command';


const stickCommand: BotCommand = {
  module: 'stickymessages',
  permissionPath: 'staff.stickymessages.stick',
  data: new SlashCommandBuilder()
    .setName('stick')
    .setDescription('Create a sticky message in a channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to stick a message in')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('content')
        .setDescription('The message content (plain text)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('interval')
        .setDescription('Re-stick after this many messages (default: 5)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('priority')
        .setDescription('Priority for multiple stickies (higher = higher priority)')
        .setMinValue(0)
        .setMaxValue(999)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any, db: any) {
    try {
      await interaction.deferReply();

      const channel = interaction.options.getChannel('channel', true);
      const content = interaction.options.getString('content') || '';
      const interval = interaction.options.getInteger('interval') || 5;
      const priority = interaction.options.getInteger('priority') || 0;

      // Validate channel
      if (!channel.isTextBased()) {
        await interaction.editReply({
          content: 'This command only works with text channels.',
        });
        return;
      }

      // Check if bot has permissions
      const botMember = await interaction.guild!.members.fetchMe();
      const permissions = (channel as TextChannel).permissionsFor(botMember);
      if (!permissions?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])) {
        await interaction.editReply({
          content: 'I need Send Messages and Manage Messages permissions in that channel.',
        });
        return;
      }

      if (!content) {
        await interaction.editReply({
          content: 'Please provide message content.',
        });
        return;
      }

      const helper = new StickyMessagesHelper(db);

      // Check if we're at the limit
      const config = await helper.getGuildConfig(interaction.guildId!);
      const existingStickies = await helper.getStickyMessagesByChannel(
        channel.id
      );

      if (existingStickies.length >= config.maxStickiesPerChannel) {
        await interaction.editReply({
          content: `This channel already has the maximum number of sticky messages (${config.maxStickiesPerChannel}). Remove one first.`,
        });
        return;
      }

      // Create the sticky message
      const sticky = await helper.createStickyMessage(
        interaction.guildId!,
        channel.id,
        content,
        null,
        interval,
        priority
      );

      // Send the initial sticky message
      try {
        const sentMessage = await (channel as TextChannel).send({
          content: content,
        });

        // Update with message ID
        await helper.updateStickyMessage(sticky.id, {
          currentMessageId: sentMessage.id,
        });

        logger.info(
          `Created sticky message ${sticky.id} in channel ${channel.id}`
        );

        await interaction.editReply({
          content: `Sticky message created! It will re-stick every ${interval} messages.`,
        });

        // Emit audit log event
        if (interaction.client.emit) {
          interaction.client.emit('auditLog', {
            type: 'STICKY_CREATED',
            userId: interaction.user.id,
            guildId: interaction.guildId!,
            details: {
              stickyId: sticky.id,
              channelId: channel.id,
              interval: interval,
              priority: priority,
            },
          });
        }
      } catch (error) {
        await helper.deleteStickyMessage(sticky.id);
        logger.error(`Failed to send initial sticky message: ${error}`);
        await interaction.editReply({
          content: 'Failed to send the sticky message. Please check my permissions.',
        });
      }
    } catch (error) {
      logger.error(`Error in stick command: ${error}`);
      await interaction.editReply({
        content: 'An error occurred while creating the sticky message.',
      });
    }
  },
};

export default stickCommand;
