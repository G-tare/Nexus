import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { canModerate, createModCase, ensureGuild, ensureGuildMember, getModConfig } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.quarantine',
  data: new SlashCommandBuilder()
    .setName('quarantine')
    .setDescription('Quarantine a user - removes all roles and assigns quarantine role')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to quarantine')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for quarantine')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Hierarchy check
      if (!canModerate(interaction.member as GuildMember, targetMember, 'quarantine')) {
        await interaction.editReply({
          embeds: [errorEmbed('Cannot moderate this user - they are equal or higher in hierarchy')]
        });
        return;
      }

      // Get mod config for quarantine role
      const modConfig = await getModConfig(guild.id);
      if (!modConfig?.quarantineRoleId) {
        await interaction.editReply({
          embeds: [errorEmbed('Quarantine role is not configured. Ask an admin to set it up')]
        });
        return;
      }

      // Store current roles in Redis
      const redis = await getRedis();
      const quarantineKey = `quarantine:${guild.id}:${targetUser.id}`;
      const roleIds = Array.from(targetMember.roles.cache.values())
        .filter(r => r.id !== guild.id) // Exclude @everyone
        .map(r => r.id);

      await redis.hset(quarantineKey, 'roles', JSON.stringify(roleIds));
      await redis.expire(quarantineKey, 7 * 24 * 60 * 60); // 7 days expiry

      // Remove all roles
      for (const role of targetMember.roles.cache.values()) {
        if (role.id !== guild.id) {
          await targetMember.roles.remove(role);
        }
      }

      // Add quarantine role
      await targetMember.roles.add(modConfig.quarantineRoleId);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Quarantine: ${reason}`,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been quarantined`);
      embed.addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in quarantine command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while quarantining the user')]
      });
    }
  }
} as BotCommand;
