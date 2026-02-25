import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { canModerate, createModCase, ensureGuild, ensureGuildMember, getModConfig } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.unquarantine',
  data: new SlashCommandBuilder()
    .setName('unquarantine')
    .setDescription('Remove quarantine from a user - restores previous roles')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to unquarantine')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for unquarantine')
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
      if (!canModerate(interaction.member as GuildMember, targetMember, 'unquarantine')) {
        await interaction.editReply({
          embeds: [errorEmbed('Cannot moderate this user - they are equal or higher in hierarchy')]
        });
        return;
      }

      // Get stored roles from Redis
      const redis = await getRedis();
      const quarantineKey = `quarantine:${guild.id}:${targetUser.id}`;
      const storedRolesJson = await redis.hget(quarantineKey, 'roles');

      if (!storedRolesJson) {
        await interaction.editReply({
          embeds: [errorEmbed('User is not quarantined')]
        });
        return;
      }

      const storedRoles: string[] = JSON.parse(storedRolesJson);

      // Get mod config for quarantine role
      const modConfig = await getModConfig(guild.id);

      // Remove quarantine role
      if (modConfig?.quarantineRoleId && targetMember.roles.cache.has(modConfig.quarantineRoleId)) {
        await targetMember.roles.remove(modConfig.quarantineRoleId);
      }

      // Restore roles
      for (const roleId of storedRoles) {
        const role = guild.roles.cache.get(roleId);
        if (role && !targetMember.roles.cache.has(roleId)) {
          await targetMember.roles.add(role);
        }
      }

      // Clean up Redis
      await redis.del(quarantineKey);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Unquarantine: ${reason}`,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been unquarantined`);
      embed.addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in unquarantine command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while unquarantining the user')]
      });
    }
  }
} as BotCommand;
