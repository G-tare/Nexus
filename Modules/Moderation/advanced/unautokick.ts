import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { createModCase, ensureGuild } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.unautokick',
  data: new SlashCommandBuilder()
    .setName('unautokick')
    .setDescription('Remove auto-kick from a user — they can rejoin the server normally')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to remove auto-kick from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing auto-kick')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const redis = await getRedis();
      const autokickSetKey = `autokick:${guild.id}`;

      const removed = await redis.srem(autokickSetKey, targetUser.id);

      if (removed === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('User is not on the auto-kick list')]
        });
        return;
      }

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Unautokick: ${reason}`,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been removed from auto-kick`);
      embed.addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unautokick command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while removing auto-kick')]
      });
    }
  }
} as BotCommand;
