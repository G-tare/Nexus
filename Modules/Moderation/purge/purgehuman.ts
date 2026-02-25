import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('purgehuman')
    .setDescription('Delete the last X messages from humans (non-bots only)')
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of human messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.purgehuman',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const count = interaction.options.getInteger('count', true);
    const channel = interaction.channel as TextChannel;

    // Check if channel is a text channel
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'This command only works in text channels.')],
      });
      return;
    }

    await interaction.deferReply({});

    try {
      // Fetch messages and filter for humans only (non-bots)
      const messages = await channel.messages.fetch({ limit: 100 });
      const now = Date.now();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

      const humanMessages = messages
        .filter(msg => !msg.author.bot && now - msg.createdTimestamp < twoWeeksMs)
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .first(count);

      if (humanMessages.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('No Messages', 'No human messages found that are less than 14 days old.')],
        });
        return;
      }

      // Delete messages
      await channel.bulkDelete(humanMessages, true);

      const embed = successEmbed(
        'Human Messages Purged',
        `Successfully deleted **${humanMessages.length}** human message(s) from ${channel}.`
      ).setColor(Colors.Moderation);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Purge human command error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Purge Failed', 'An error occurred while deleting messages.')],
      });
    }
  },
};

export default command;
