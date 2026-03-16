import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBirthdayConfig,
  getUpcomingBirthdays,
  buildUpcomingContainer,
} from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.upcoming',
  premiumFeature: 'birthdays.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('birthdayupcoming')
    .setDescription('Show upcoming birthdays in this server')
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Number of days to look ahead (default: 30)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365)
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

      const days = interaction.options.getInteger('days') || 30;
      const upcoming = await getUpcomingBirthdays(interaction.guildId!, days);

      const container = buildUpcomingContainer(upcoming, `🎂 Upcoming Birthdays (Next ${days} Days)`);
      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Birthdays] /birthdayupcoming error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching upcoming birthdays.',
      });
    }
  },
};

export default command;
