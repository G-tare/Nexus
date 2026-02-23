import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { getRedis } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';
import { ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.userinfo',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get comprehensive information about a user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to get info about')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Get database info
      const db = await getDb();
      const dbData = await db
        .select()
        .from(guildMembers)
        .where(
          eq(guildMembers.guildId, guild.id) &&
          eq(guildMembers.userId, targetUser.id)
        )
        .limit(1);

      const memberData = dbData[0] || null;

      // Check if on watchlist
      const redis = await getRedis();
      const watchlistSetKey = `watchlist:${guild.id}`;
      const watchlistEntries = await redis.smembers(watchlistSetKey);
      let isWatchlisted = false;

      for (const entry of watchlistEntries) {
        const parsed = JSON.parse(entry);
        if (parsed.userId === targetUser.id) {
          isWatchlisted = true;
          break;
        }
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(isWatchlisted ? Colors.Error : Colors.Info)
        .setTitle(`User Info - ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'Username', value: targetUser.username, inline: true },
          { name: 'Display Name', value: targetMember.displayName || 'None', inline: true },
          { name: 'User ID', value: targetUser.id, inline: false },
          { name: 'Account Created', value: discordTimestamp(new Date(targetUser.createdTimestamp)), inline: true },
          { name: 'Joined Server', value: targetMember.joinedAt ? discordTimestamp(new Date(targetMember.joinedTimestamp!)) : 'Unknown', inline: true }
        );

      if (isWatchlisted) {
        embed.addFields({ name: '⚠️ Watchlist Status', value: 'This user is on the server watchlist', inline: false });
      }

      // Roles
      const roles = targetMember.roles.cache
        .filter((r: any) => r.id !== guild.id)
        .sort((a: any, b: any) => b.position - a.position)
        .map((r: any) => `<@&${r.id}>`);

      if (roles.length > 0) {
        const rolesText = roles.length > 10 ? roles.slice(0, 10).join(', ') + `\n+${roles.length - 10} more` : roles.join(', ');
        embed.addFields({ name: `Roles (${roles.length})`, value: rolesText, inline: false });
      } else {
        embed.addFields({ name: 'Roles', value: 'No roles', inline: false });
      }

      // Highest role
      const highestRole = targetMember.roles.highest;
      if (highestRole.id !== guild.id) {
        embed.addFields({ name: 'Highest Role', value: `<@&${highestRole.id}>`, inline: true });
      }

      // Boosting status
      const isBoosting = targetMember.premiumSince !== null;
      embed.addFields({ name: 'Server Booster', value: isBoosting ? 'Yes' : 'No', inline: true });

      // Timeout status
      if (targetMember.isCommunicationDisabled()) {
        const timeoutUntil = targetMember.communicationDisabledUntil;
        embed.addFields({ name: 'Timeout Until', value: discordTimestamp(timeoutUntil!), inline: true });
      } else {
        embed.addFields({ name: 'Timeout Status', value: 'Not timed out', inline: true });
      }

      // Database info if available
      if (memberData) {
        embed.addFields(
          { name: 'Level', value: String(memberData.level || 0), inline: true },
          { name: 'XP', value: String(memberData.xp || 0), inline: true },
          { name: 'Coins', value: String(memberData.coins || 0), inline: true },
          { name: 'Total Messages', value: String((memberData as any).messageCount || 0), inline: true },
          { name: 'Voice Minutes', value: String((memberData as any).voiceMinutes || 0), inline: true },
          { name: 'Warnings', value: String(memberData.warnCount || 0), inline: true },
          { name: 'Reputation', value: String(memberData.reputation || 0), inline: true }
        );
      }

      embed.setFooter({ text: `Requested by ${interaction.user.tag}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in userinfo command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while fetching user information')]
      });
    }
  }
} as BotCommand;
