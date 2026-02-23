import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBirthdayConfig,
  getBirthdaysInMonth,
  buildUpcomingEmbed,
} from '../helpers';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.list',
  premiumFeature: 'birthdays.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('birthdaylist')
    .setDescription('Show all birthdays in a specific month')
    .addIntegerOption((option) =>
      option
        .setName('month')
        .setDescription('Month to show (1-12, defaults to current month)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(12)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      const config = await getBirthdayConfig(interaction.guildId!);
      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ Birthday module is disabled in this server.',
        });
      }

      const month = interaction.options.getInteger('month') || (new Date().getMonth() + 1);
      const birthdays = await getBirthdaysInMonth(interaction.guildId!, month);

      const embed = buildUpcomingEmbed(birthdays, `🎂 Birthdays in ${monthNames[month - 1]}`);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Birthdays] /birthdaylist error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching birthdays.',
      });
    }
  },
};

export default command;
