import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { cache } from '../../../Shared/src/cache/cacheManager';
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
      const shadowbanSetKey = `shadowban:${guild.id}`;

      // Check if user is shadowbanned before removing
      if (!cache.sismember(shadowbanSetKey, targetUser.id)) {
        await interaction.editReply({
          embeds: [errorEmbed('User is not shadow banned')]
        });
        return;
      }

      cache.srem(shadowbanSetKey, targetUser.id);

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
