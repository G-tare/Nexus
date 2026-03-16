import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, infoContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ensureGuild } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('View moderation statistics for a staff member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(option =>
      option
        .setName('moderator')
        .setDescription('The moderator to check stats for (defaults to you)')
        .setRequired(false)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.modstats',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply(v2Payload([errorContainer('Guild context required')]));

    const db = getDb();
    const targetUser = interaction.options.getUser('moderator') || interaction.user;

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all-time stats
      const allTimeStats = await db
        .select({
          action: modCases.action,
          count: sql<number>`COUNT(*)`,
        })
        .from(modCases)
        .where(
          and(
            eq(modCases.guildId, guildId),
            eq(modCases.moderatorId, targetUser.id)
          )
        )
        .groupBy(modCases.action);

      // Get last 7 days stats
      const last7DaysStats = await db
        .select({
          action: modCases.action,
          count: sql<number>`COUNT(*)`,
        })
        .from(modCases)
        .where(
          and(
            eq(modCases.guildId, guildId),
            eq(modCases.moderatorId, targetUser.id),
            sql`${modCases.createdAt} >= ${sevenDaysAgo}`
          )
        )
        .groupBy(modCases.action);

      // Convert to maps for easy lookup
      const allTimeMap = new Map(allTimeStats.map(s => [s.action, s.count]));
      const last7DaysMap = new Map(last7DaysStats.map(s => [s.action, s.count]));

      const totalAllTime = Array.from(allTimeMap.values()).reduce((a, b) => a + b, 0);
      const totalLast7Days = Array.from(last7DaysMap.values()).reduce((a, b) => a + b, 0);

      const container = infoContainer('Moderation Statistics', `Stats for ${targetUser.username}`);
      addFields(container, [
        {
          name: 'All Time',
          value: `Total Actions: **${totalAllTime}**\n` +
            `Bans: **${allTimeMap.get('ban') || 0}**\n` +
            `Kicks: **${allTimeMap.get('kick') || 0}**\n` +
            `Mutes: **${allTimeMap.get('mute') || 0}**\n` +
            `Warns: **${allTimeMap.get('warn') || 0}**\n` +
            `Notes: **${allTimeMap.get('note') || 0}**`,
          inline: true,
        },
        {
          name: 'Last 7 Days',
          value: `Total Actions: **${totalLast7Days}**\n` +
            `Bans: **${last7DaysMap.get('ban') || 0}**\n` +
            `Kicks: **${last7DaysMap.get('kick') || 0}**\n` +
            `Mutes: **${last7DaysMap.get('mute') || 0}**\n` +
            `Warns: **${last7DaysMap.get('warn') || 0}**\n` +
            `Notes: **${last7DaysMap.get('note') || 0}**`,
          inline: true,
        }
      ]);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in modstats command:', error);
      return interaction.editReply(v2Payload([errorContainer('An error occurred while retrieving statistics')]));
    }
  },
} as BotCommand;
