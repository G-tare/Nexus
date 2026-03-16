import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, V2Colors } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete the last X messages in the channel')
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.purge',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const count = interaction.options.getInteger('count', true);
    const channel = interaction.channel as TextChannel;

    // Check if channel is a text channel
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        components: [errorContainer('Invalid Channel', 'This command only works in text channels.')],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    await interaction.deferReply({});

    try {
      // Get the bot's deferred reply so we can exclude it
      const reply = await interaction.fetchReply();

      // Fetch messages and filter out those older than 14 days + exclude the bot's reply
      const messages = await channel.messages.fetch({ limit: count + 1 });
      const now = Date.now();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

      const deletableMessages = messages.filter(
        msg => msg.id !== reply.id && now - msg.createdTimestamp < twoWeeksMs,
      );

      if (deletableMessages.size === 0) {
        await interaction.editReply({
          components: [errorContainer('No Messages', 'No messages found that are less than 14 days old.')],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Delete messages
      await channel.bulkDelete(deletableMessages, true);

      const container = successContainer(
        'Messages Purged',
        `Successfully deleted **${deletableMessages.size}** message(s) from ${channel}.`
      );

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Purge command error:', error);
      await interaction.editReply({
        components: [errorContainer('Purge Failed', 'An error occurred while deleting messages.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};

export default command;
