import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import { Colors } from '../../../../Shared/src/utils/embed';
import { getDb } from '../../../../Shared/src/database/connection';
import { tickets } from '../../../../Shared/src/database/models/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import type { TicketConfig } from '../../helpers';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.stats',
  defaultPermissions: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder()
    .setName('ticket-stats')
    .setDescription('View ticket statistics')
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Number of days to analyze (default: 30)')
        .setMinValue(1)
        .setMaxValue(365)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    // Check permission
    const permissions = interaction.member?.permissions;
    if (typeof permissions === 'string' || !permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the Manage Guild permission.',
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ Tickets module is not enabled.',
      });
    }

    await interaction.deferReply();

    try {
      const days = interaction.options.getInteger('days') || 30;
      const stats = await getTicketStats(interaction.guildId!, days, config);

      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setTitle(`Ticket Statistics (Last ${days} Days)`)
        .addFields(
          {
            name: 'Open Tickets',
            value: stats.open.toString(),
            inline: true,
          },
          {
            name: 'Closed Tickets',
            value: stats.closed.toString(),
            inline: true,
          },
          {
            name: 'Total Created',
            value: stats.created.toString(),
            inline: true,
          }
        );

      if (stats.avgResponseTime > 0) {
        embed.addFields({
          name: 'Avg Response Time',
          value: formatMinutes(stats.avgResponseTime),
          inline: true,
        });
      }

      if (config.feedbackEnabled && stats.avgRating > 0) {
        embed.addFields({
          name: 'Average Feedback Rating',
          value: `${stats.avgRating}/5 ⭐`,
          inline: true,
        });
      }

      if (stats.topStaff.length > 0) {
        const staffList = stats.topStaff
          .slice(0, 5)
          .map((s) => `<@${s.userId}>: ${s.count} closed`)
          .join('\n');

        embed.addFields({
          name: 'Top Staff (by tickets closed)',
          value: staffList,
          inline: false,
        });
      }

      return interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('[Tickets] Error fetching stats:', error);
      return interaction.editReply({
        content: '❌ Failed to retrieve statistics.',
      });
    }
  },
};

interface TicketStats {
  open: number;
  closed: number;
  created: number;
  avgResponseTime: number;
  avgRating: number;
  topStaff: Array<{ userId: string; count: number }>;
}

async function getTicketStats(
  guildId: string,
  days: number,
  config: TicketConfig
): Promise<TicketStats> {
  const db = getDb();
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  // Open tickets
  const openResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(and(eq(tickets.guildId, guildId), eq(tickets.status, 'open')));

  const open = openResult[0]?.count || 0;

  // Closed tickets in period
  const closedResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(
      and(
        eq(tickets.guildId, guildId),
        eq(tickets.status, 'closed'),
        gte(tickets.closedAt, dateThreshold)
      )
    );

  const closed = closedResult[0]?.count || 0;

  // Total created in period
  const createdResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tickets)
    .where(and(eq(tickets.guildId, guildId), gte(tickets.createdAt, dateThreshold)));

  const created = createdResult[0]?.count || 0;

  // Top staff
  const topStaffResult = await db
    .select({
      userId: tickets.closedBy,
      count: sql<number>`COUNT(*)`,
    })
    .from(tickets)
    .where(
      and(
        eq(tickets.guildId, guildId),
        eq(tickets.status, 'closed'),
        gte(tickets.closedAt, dateThreshold),
        sql`${tickets.closedBy} IS NOT NULL`
      )
    )
    .groupBy(tickets.closedBy)
    .orderBy(desc(sql<number>`COUNT(*)`))
    .limit(5);

  const topStaff = (topStaffResult || []).map((r) => ({
    userId: r.userId || '',
    count: r.count || 0,
  }));

  // Average feedback rating
  let avgRating = 0;
  if (config.feedbackEnabled) {
    const feedbackResult = await db
      .select({ avg: sql<number>`AVG(${(tickets as any).feedbackRating})` })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          sql`${(tickets as any).feedbackRating} IS NOT NULL`
        )
      );

    avgRating = feedbackResult[0]?.avg ? parseFloat(feedbackResult[0].avg.toFixed(2)) : 0;
  }

  return {
    open,
    closed,
    created,
    avgResponseTime: 0, // Would require additional timestamp tracking
    avgRating,
    topStaff,
  };
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)} hours`;
  }

  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export default command;
