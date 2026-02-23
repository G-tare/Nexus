import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { removeAFK } from '../helpers';

const command: BotCommand = {
  module: 'afk',
  permissionPath: 'afk.afk-remove',
  data: new SlashCommandBuilder()
    .setName('afk-remove')
    .setDescription('Force remove someone\'s AFK status (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to remove AFK status from')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user')!;
      const targetMember = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);

      // Try to remove AFK
      const afkData = await removeAFK(interaction.guildId!, targetUser.id);

      if (!afkData) {
        return await interaction.editReply({
          content: `⚠️ ${targetUser.tag} is not AFK.`,
        });
      }

      // Try to restore nickname
      if (afkData.nickname && targetMember && 'setNickname' in targetMember) {
        try {
          await targetMember.setNickname(afkData.nickname);
        } catch (err) {
          console.error('Error restoring nickname:', err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ AFK Status Removed')
        .addFields(
          {
            name: 'User',
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false,
          },
          {
            name: 'Was AFK For',
            value: `<t:${Math.floor(afkData.setAt.getTime() / 1000)}:R>`,
            inline: false,
          },
          {
            name: 'Message',
            value: afkData.message,
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /afk-remove command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while removing AFK status.',
      });
    }
  },
};

export default command;
