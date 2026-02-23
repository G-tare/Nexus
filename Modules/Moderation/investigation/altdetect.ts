import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ColorResolvable } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';
import { ensureGuild, ensureGuildMember } from '../helpers';

// Simple Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.altdetect',
  data: new SlashCommandBuilder()
    .setName('altdetect')
    .setDescription('Check if a user might be an alt account')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      const redis = await getRedis();
      const flags: string[] = [];
      let riskScore = 0;

      // Check account age
      const accountAge = Date.now() - targetUser.createdTimestamp;
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

      if (daysSinceCreation < 7) {
        flags.push(`⚠️ Very new account (${Math.floor(daysSinceCreation)} days old)`);
        riskScore += 40;
      }

      // Check if manually flagged as alt
      const altsSetKey = `alts:${guild.id}`;
      const isManuallyFlagged = await redis.sismember(altsSetKey, targetUser.id);
      if (isManuallyFlagged) {
        flags.push('🚩 Manually flagged as alt');
        riskScore += 50;
      }

      // Check for similar usernames
      const targetUsernameLower = targetUser.username.toLowerCase();
      const similarUsernames: string[] = [];

      for (const member of guild.members.cache.values()) {
        if (member.user.id === targetUser.id) continue;

        const memberUsernameLower = member.user.username.toLowerCase();
        const distance = levenshteinDistance(targetUsernameLower, memberUsernameLower);

        if (distance < 3) {
          similarUsernames.push(`${member.user.tag} (distance: ${distance})`);
        } else if (
          memberUsernameLower.includes(targetUsernameLower) ||
          targetUsernameLower.includes(memberUsernameLower)
        ) {
          similarUsernames.push(`${member.user.tag} (substring match)`);
        }
      }

      if (similarUsernames.length > 0) {
        flags.push(`📝 Similar usernames:\n${similarUsernames.slice(0, 3).join('\n')}`);
        riskScore += 20;
      }

      // Check for avatar hash similarity (users with same avatar)
      const targetAvatarHash = targetUser.avatar;
      if (targetAvatarHash) {
        const similarAvatars: string[] = [];
        for (const member of guild.members.cache.values()) {
          if (member.user.id === targetUser.id) continue;
          if (member.user.avatar === targetAvatarHash) {
            similarAvatars.push(member.user.tag);
          }
        }

        if (similarAvatars.length > 0) {
          flags.push(`🖼️ Identical avatar: ${similarAvatars.slice(0, 3).join(', ')}`);
          riskScore += 30;
        }
      }

      // Check for accounts created near this one
      const createdNearby: string[] = [];
      for (const member of guild.members.cache.values()) {
        if (member.user.id === targetUser.id) continue;

        const timeDiff = Math.abs(
          member.user.createdTimestamp - targetUser.createdTimestamp
        );
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff < 1) {
          createdNearby.push(member.user.tag);
        }
      }

      if (createdNearby.length > 0) {
        flags.push(`⏰ Accounts created within 1 hour: ${createdNearby.slice(0, 3).join(', ')}`);
        riskScore += 25;
      }

      // Cap risk score at 100
      riskScore = Math.min(riskScore, 100);

      // Determine confidence level
      let confidenceLevel: string;
      let confidenceColor: ColorResolvable;

      if (riskScore >= 70) {
        confidenceLevel = 'HIGH';
        confidenceColor = Colors.Error as number;
      } else if (riskScore >= 40) {
        confidenceLevel = 'MEDIUM';
        confidenceColor = Colors.Warning as number;
      } else {
        confidenceLevel = 'LOW';
        confidenceColor = Colors.Success as number;
      }

      const embed = new EmbedBuilder()
        .setColor(confidenceColor as any)
        .setTitle(`Alt Detection Report for ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Confidence Level', value: confidenceLevel, inline: true },
          { name: 'Risk Score', value: `${riskScore}%`, inline: true },
          { name: 'Flags', value: flags.length > 0 ? flags.join('\n') : 'No flags detected' }
        )
        .setFooter({ text: `Account created: ${targetUser.createdAt.toDateString()}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in altdetect command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while checking for alts')]
      });
    }
  }
} as BotCommand;
