import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { createModCase, ensureGuild } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.unshadowban',
  data: new SlashCommandBuilder()
    .setName('unshadowban')
    .setDescription('Remove shadow ban from a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to remove shadow ban from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing shadow ban')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const redis = await getRedis();
      const shadowbanSetKey = `shadowban:${guild.id}`;

      const removed = await redis.srem(shadowbanSetKey, targetUser.id);

      if (removed === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('User is not shadow banned')]
        });
        return;
      }

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Unshadowban: ${reason}`,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been removed from shadow ban`);
      embed.addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unshadowban command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while removing shadow ban')]
      });
    }
  }
} as BotCommand;
