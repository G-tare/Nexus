import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { removeAFK } from '../helpers';
import { successContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
    await interaction.deferReply();

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
        } catch {
          // Bot may lack permission to change nickname for this user
        }
      }

      const container = successContainer('✅ AFK Status Removed');
      addFields(container, [
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
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in /afk-remove command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while removing AFK status.',
      });
    }
  },
};

export default command;
