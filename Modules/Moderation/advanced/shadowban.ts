import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { getRedis } from '../../../Shared/src/database/connection';
import { modCases, guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { discordTimestamp, formatDuration } from '../../../Shared/src/utils/time';
import { canModerate, createModCase, modActionEmbed, ensureGuild, ensureGuildMember, getModConfig } from '../helpers';

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
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Hierarchy check
      if (!canModerate(interaction.member as GuildMember, targetMember, 'shadowban')) {
        await interaction.editReply({
          embeds: [errorEmbed('Cannot moderate this user - they are equal or higher in hierarchy')]
        });
        return;
      }

      // Get Redis and add to shadowban set
      const redis = await getRedis();
      const shadowbanSetKey = `shadowban:${guild.id}`;
      await redis.sadd(shadowbanSetKey, targetUser.id);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Shadowban: ${reason}`,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been shadow banned`);
      embed.addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in shadowban command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while shadow banning the user')]
      });
    }
  }
} as BotCommand;
