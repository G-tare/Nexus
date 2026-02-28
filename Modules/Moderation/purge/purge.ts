import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

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
        embeds: [errorEmbed('Invalid Channel', 'This command only works in text channels.')],
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
          embeds: [errorEmbed('No Messages', 'No messages found that are less than 14 days old.')],
        });
        return;
      }

      // Delete messages
      await channel.bulkDelete(deletableMessages, true);

      const embed = successEmbed(
        'Messages Purged',
        `Successfully deleted **${deletableMessages.size}** message(s) from ${channel}.`
      ).setColor(Colors.Moderation);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Purge command error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Purge Failed', 'An error occurred while deleting messages.')],
      });
    }
  },
};

export default command;
