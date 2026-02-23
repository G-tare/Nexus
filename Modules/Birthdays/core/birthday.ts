import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBirthdayConfig,
  setBirthday,
  getBirthday,
  isValidDate,
  formatBirthday,
} from '../helpers';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.set',
  premiumFeature: 'birthdays.basic',
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Set your birthday')
    .addIntegerOption((option) =>
      option
        .setName('month')
        .setDescription('Birth month (1-12)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(12)
    )
    .addIntegerOption((option) =>
      option
        .setName('day')
        .setDescription('Birth day (1-31)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(31)
    )
    .addIntegerOption((option) =>
      option
        .setName('year')
        .setDescription('Birth year (optional, for age display)')
        .setRequired(false)
        .setMinValue(1900)
        .setMaxValue(2025)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await getBirthdayConfig(interaction.guildId!);
      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ Birthday module is disabled in this server.',
        });
      }

      const month = interaction.options.getInteger('month', true);
      const day = interaction.options.getInteger('day', true);
      const year = interaction.options.getInteger('year') ?? undefined;

      // Validate date
      if (!isValidDate(month, day)) {
        return await interaction.editReply({
          content: '❌ Invalid date. Please provide a valid month and day.',
        });
      }

      // Validate year if provided
      if (year !== undefined) {
        const currentYear = new Date().getFullYear();
        if (year > currentYear - 5) {
          return await interaction.editReply({
            content: '❌ Please provide a valid birth year.',
          });
        }

        if (!config.allowHideYear) {
          // Year is required and visible in this server
        }
      }

      // Check if they already have a birthday set
      const existing = await getBirthday(interaction.user.id);
      const isUpdate = existing !== null;

      await setBirthday(interaction.user.id, month, day, year);

      const birthdayStr = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const formatted = formatBirthday(birthdayStr, year, config.showAge);

      await interaction.editReply({
        content: `✅ Your birthday has been ${isUpdate ? 'updated' : 'set'} to **${formatted}**!${
          !year && config.showAge ? '\n💡 Tip: Add your birth year to show your age on your birthday!' : ''
        }`,
      });
    } catch (error) {
      console.error('[Birthdays] /birthday set error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting your birthday.',
      });
    }
  },
};

export default command;
