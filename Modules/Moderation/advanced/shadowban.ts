import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields } from '../../../Shared/src/utils/componentsV2';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { modCases, guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { discordTimestamp, formatDuration } from '../../../Shared/src/utils/time';
import { canModerate, createModCase, ensureGuild, ensureGuildMember, getModConfig } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.shadowban',
  data: new SlashCommandBuilder()
    .setName('shadowban')
    .setDescription('Shadow ban a user - they stay in the server but all messages are auto-deleted')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to shadow ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for shadow ban')
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
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Hierarchy check
      if (!canModerate(interaction.member as GuildMember, targetMember, 'shadowban')) {
        await interaction.editReply(v2Payload([
          errorContainer('Cannot moderate this user', 'They are equal or higher in hierarchy')
        ]));
        return;
      }

      // Add to shadowban set (in-memory)
      const shadowbanSetKey = `shadowban:${guild.id}`;
      cache.sadd(shadowbanSetKey, targetUser.id);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Shadowban: ${reason}`,
      });

      const container = successContainer(`User ${targetUser.tag} has been shadow banned`);
      addFields(container, [{ name: 'Reason', value: reason }]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in shadowban command:', error);
      await interaction.editReply(v2Payload([
        errorContainer('An error occurred while shadow banning the user')
      ]));
    }
  }
} as BotCommand;
