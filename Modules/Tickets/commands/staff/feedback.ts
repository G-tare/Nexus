import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ContainerBuilder,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import {
  moduleContainer,
  addText,
  addFields,
  successContainer,
  v2Payload,
} from '../../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../../Shared/src/database/connection';
import { tickets } from '../../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { TicketConfig } from '../../helpers';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.feedback',
  defaultPermissions: [PermissionFlagsBits.ManageGuild],
  data: new SlashCommandBuilder()
    .setName('ticket-feedback')
    .setDescription('Manage the feedback system')
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the feedback system')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable feedback system')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View feedback statistics')
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

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'toggle':
        return handleToggle(interaction, config, interaction.guildId!);
      case 'view':
        return handleView(interaction, interaction.guildId!);
      default:
        return interaction.reply({
          content: '❌ Unknown subcommand.',
        });
    }
  },
};

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  config: TicketConfig,
  guildId: string
) {
  const enabled = interaction.options.getBoolean('enabled', true);
  config.feedbackEnabled = enabled;
  moduleConfig.setConfig(guildId, 'tickets', config);

  const container = successContainer(
    'Feedback System',
    enabled
      ? '✅ Feedback system enabled. Users will receive feedback requests after their tickets close.'
      : '❌ Feedback system disabled.'
  );

  return interaction.reply(v2Payload([container]));
}

async function handleView(
  interaction: ChatInputCommandInteraction,
  guildId: string
) {
  await interaction.deferReply();

  try {
    const db = getDb();

    // Get feedback statistics
    const result = await db
      .select({
        totalFeedback: sql<number>`COUNT(*)`,
        avgRating: sql<number>`AVG(${(tickets as any).feedbackRating})`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          sql`${(tickets as any).feedbackRating} IS NOT NULL`
        )
      );

    const stats = result[0];
    const totalFeedback = stats.totalFeedback || 0;
    const avgRating = stats.avgRating ? parseFloat(stats.avgRating.toFixed(2)) : 0;

    // Get rating breakdown
    const ratingBreakdown = await db
      .select({
        rating: (tickets as any).feedbackRating,
        count: sql<number>`COUNT(*)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          sql`${(tickets as any).feedbackRating} IS NOT NULL`
        )
      )
      .groupBy((tickets as any).feedbackRating);

    const container = moduleContainer('tickets');
    addText(container, '### Ticket Feedback Statistics');

    const fields = [
      {
        name: 'Total Feedback Responses',
        value: totalFeedback.toString(),
        inline: true,
      },
      {
        name: 'Average Rating',
        value: totalFeedback > 0 ? `${avgRating}/5 ⭐` : 'No ratings yet',
        inline: true,
      },
    ];

    if (ratingBreakdown.length > 0) {
      const breakdown = ratingBreakdown
        .sort((a, b) => (a.rating || 0) - (b.rating || 0))
        .map((r) => `${r.rating}⭐: ${r.count} response${r.count !== 1 ? 's' : ''}`)
        .join('\n');

      fields.push({
        name: 'Rating Breakdown',
        value: breakdown,
        inline: false,
      });
    }

    addFields(container, fields);

    return interaction.editReply(v2Payload([container]));
  } catch (error) {
    console.error('[Tickets] Error fetching feedback stats:', error);
    return interaction.editReply({
      content: '❌ Failed to retrieve feedback statistics.',
    });
  }
}

export default command;
