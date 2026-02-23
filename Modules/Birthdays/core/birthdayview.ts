import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBirthdayConfig,
  getBirthday,
  buildBirthdayViewEmbed,
} from '../helpers';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.view',
  premiumFeature: 'birthdays.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('birthdayview')
    .setDescription("View someone's birthday")
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to view (defaults to yourself)')
        .setRequired(false)
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

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const entry = await getBirthday(targetUser.id);

      if (!entry) {
        const isSelf = targetUser.id === interaction.user.id;
        return await interaction.editReply({
          content: isSelf
            ? "❌ You haven't set your birthday yet. Use `/birthday` to set it!"
            : `❌ ${targetUser.username} hasn't set their birthday.`,
        });
      }

      const embed = buildBirthdayViewEmbed(entry, config.showAge);
      embed.setThumbnail(targetUser.displayAvatarURL({ size: 256 }));

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Birthdays] /birthdayview error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching the birthday.',
      });
    }
  },
};

export default command;
