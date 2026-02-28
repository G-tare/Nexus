import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { canModerate, createModCase, ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.autokick',
  data: new SlashCommandBuilder()
    .setName('autokick')
    .setDescription('Auto-kick a user — they get kicked every time they rejoin the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to auto-kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for auto-kick')
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
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      // Hierarchy check (only if member is still in the server)
      if (targetMember && !canModerate(interaction.member as GuildMember, targetMember, 'autokick')) {
        await interaction.editReply({
          embeds: [errorEmbed('Cannot moderate this user - they are equal or higher in hierarchy')]
        });
        return;
      }

      // Add to auto-kick set in Redis
      const redis = await getRedis();
      const autokickSetKey = `autokick:${guild.id}`;
      await redis.sadd(autokickSetKey, targetUser.id);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Autokick: ${reason}`,
      });

      // Immediately kick if they're still in the server
      if (targetMember) {
        try {
          await targetMember.kick(`[AUTO-KICK] ${reason}`);
        } catch {
          // Kick failed — they're still on the auto-kick list for next rejoin
        }
      }

      const embed = successEmbed(`User ${targetUser.tag} has been added to auto-kick`);
      embed.addFields(
        { name: 'Reason', value: reason },
        { name: 'Effect', value: 'This user will be automatically kicked every time they rejoin the server.' },
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in autokick command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while setting up auto-kick')]
      });
    }
  }
} as BotCommand;
