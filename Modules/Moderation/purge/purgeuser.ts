import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('purgeuser')
    .setDescription('Delete the last X messages from a specific user')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user whose messages to delete')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.purgeuser',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user', true);
    const count = interaction.options.getInteger('count', true);
    const channel = interaction.channel as TextChannel;

    // Check if channel is a text channel
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'This command only works in text channels.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch up to 100 messages and filter by user
      const messages = await channel.messages.fetch({ limit: 100 });
      const now = Date.now();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

      const userMessages = messages
        .filter(msg => msg.author.id === targetUser.id && now - msg.createdTimestamp < twoWeeksMs)
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
        .first(count);

      if (userMessages.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('No Messages', `No messages found from ${targetUser} that are less than 14 days old.`)],
        });
        return;
      }

      // Delete messages
      await channel.bulkDelete(userMessages, true);

      const embed = successEmbed(
        'User Messages Purged',
        `Successfully deleted **${userMessages.length}** message(s) from ${targetUser} in ${channel}.`
      ).setColor(Colors.Moderation);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Purge user command error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Purge Failed', 'An error occurred while deleting messages.')],
      });
    }
  },
};

export default command;
