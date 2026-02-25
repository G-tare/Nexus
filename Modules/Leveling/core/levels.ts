import {  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, desc, and, gt, sql } from 'drizzle-orm';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { levelFromTotalXp } from '../helpers';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.levels',
  premiumFeature: 'leveling.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('View the XP leaderboard for this server')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('The page number to view (defaults to 1)')
        .setMinValue(1)
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;
      const pageInput = interaction.options.getInteger('page') || 1;
      const page = Math.max(1, pageInput);
      const pageSize = 10;
      const offset = (page - 1) * pageSize;

      if (!guildId) {
        return interaction.editReply({
          embeds: [
            errorEmbed('Error', 'This command can only be used in a server.')
              .setColor(Colors.Error)
          ]
        });
      }

      const db = getDb();

      // Get total count of members with XP
      const [countResult] = await db
        .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          gt(guildMembers.totalXp, 0)
        ));

      const totalMembers = countResult?.count || 0;

      if (totalMembers === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Info)
              .setTitle('XP Leaderboard')
              .setDescription('No members have earned XP yet.')
              .setTimestamp()
          ]
        });
      }

      const totalPages = Math.ceil(totalMembers / pageSize);

      if (page > totalPages) {
        return interaction.editReply({
          embeds: [
            errorEmbed('Error', `Page ${page} does not exist. Maximum page is ${totalPages}.`)
              .setColor(Colors.Error)
          ]
        });
      }

      // Fetch leaderboard data
      const members = await db
        .select({
          userId: guildMembers.userId,
          totalXp: guildMembers.totalXp,
          level: guildMembers.level,
        })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          gt(guildMembers.totalXp, 0)
        ))
        .orderBy(desc(guildMembers.totalXp))
        .limit(pageSize)
        .offset(offset);

      if (members.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Info)
              .setTitle('XP Leaderboard')
              .setDescription('No members on this page.')
              .setTimestamp()
          ]
        });
      }

      // Build leaderboard embed
      const guild = interaction.guild!;
      let description = '';

      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const rankNumber = offset + i + 1;
        const totalXp = Number(member.totalXp);

        // Try to get user for mention
        let userDisplay = `<@${member.userId}>`;
        try {
          const user = await interaction.client.users.fetch(member.userId);
          userDisplay = `${user.username}`;
        } catch {
          // Use fallback if fetch fails
          userDisplay = `User ${member.userId}`;
        }

        const levelInfo = levelFromTotalXp(totalXp);

        description += `**#${rankNumber}** ${userDisplay} — Level ${levelInfo.level} • ${totalXp.toLocaleString()} XP\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Leveling)
        .setTitle(`XP Leaderboard — ${guild.name}`)
        .setDescription(description)
        .setFooter({
          text: `Page ${page}/${totalPages} • ${totalMembers} total ranked members`,
          iconURL: guild.iconURL() || undefined
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Levels Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while fetching the leaderboard.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
