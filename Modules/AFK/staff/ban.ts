import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAFKConfig, setAFKConfig, removeAFK } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, errorContainer, successContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'afk',
  permissionPath: 'afk.afk-ban',
  data: new SlashCommandBuilder()
    .setName('afk-ban')
    .setDescription('Manage AFK system bans (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a user from using AFK')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('The user to ban from AFK')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Reason for the ban (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('unban')
        .setDescription('Unban a user from AFK system')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('The user to unban')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all banned users in this server')
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();
      const config = await getAFKConfig(interaction.guildId!);

      if (subcommand === 'ban') {
        const targetUser = interaction.options.getUser('user')!;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Check if already banned
        if (config.bannedUsers.includes(targetUser.id)) {
          return await interaction.editReply({
            content: `⚠️ ${targetUser.tag} is already banned from AFK.`,
          });
        }

        // Add to banned users
        config.bannedUsers.push(targetUser.id);
        await setAFKConfig(interaction.guildId!, { bannedUsers: config.bannedUsers });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { bannedUsers: config.bannedUsers });

        // Remove their AFK status if active
        await removeAFK(interaction.guildId!, targetUser.id);

        const container = errorContainer('🚫 User Banned from AFK');
        addFields(container, [
          {
            name: 'User',
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false,
          },
          {
            name: 'Reason',
            value: reason,
            inline: false,
          }
        ]);

        return await interaction.editReply(v2Payload([container]));
      }

      if (subcommand === 'unban') {
        const targetUser = interaction.options.getUser('user')!;

        // Check if actually banned
        if (!config.bannedUsers.includes(targetUser.id)) {
          return await interaction.editReply({
            content: `⚠️ ${targetUser.tag} is not banned from AFK.`,
          });
        }

        // Remove from banned users
        config.bannedUsers = config.bannedUsers.filter((id) => id !== targetUser.id);
        await setAFKConfig(interaction.guildId!, { bannedUsers: config.bannedUsers });
        await moduleConfig.setConfig(interaction.guildId!, 'afk', { bannedUsers: config.bannedUsers });

        const container = successContainer('✅ User Unbanned from AFK');
        addFields(container, [
          {
            name: 'User',
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false,
          }
        ]);

        return await interaction.editReply(v2Payload([container]));
      }

      if (subcommand === 'list') {
        if (config.bannedUsers.length === 0) {
          return await interaction.editReply({
            content: 'No users are banned from AFK in this server.',
          });
        }

        const bannedList = config.bannedUsers.slice(0, 25).map((id, idx) => `${idx + 1}. <@${id}>`).join('\n');
        const container = errorContainer('🚫 AFK Bans', bannedList);
        if (config.bannedUsers.length > 25) {
          addText(container, `-# Showing 25 of ${config.bannedUsers.length}`);
        } else {
          addText(container, `-# ${config.bannedUsers.length} total`);
        }

        return await interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      console.error('Error in /afk-ban command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while managing AFK bans.',
      });
    }
  },
};

export default command;
