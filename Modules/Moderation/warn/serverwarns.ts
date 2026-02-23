import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { Colors } from '../../../Shared/src/utils/embed';
import { discordTimestamp } from '../../../Shared/src/utils/time';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('serverwarns')
    .setDescription('View all active warnings server-wide')
    .addIntegerOption(opt =>
      opt.setName('page').setDescription('Page number').setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.serverwarns',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;
    const guild = interaction.guild!;

    await interaction.deferReply({ ephemeral: true });

    const db = getDb();

    // Get total count
    const [countResult] = await db.select({
      count: sql<number>`count(*)`,
    })
      .from(modCases)
      .where(
        and(
          eq(modCases.guildId, guild.id),
          eq(modCases.action, 'warn'),
          eq(modCases.isActive, true)
        )
      );

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / perPage) || 1;
    const currentPage = Math.min(page, totalPages);

    const warns = await db.select()
      .from(modCases)
      .where(
        and(
          eq(modCases.guildId, guild.id),
          eq(modCases.action, 'warn'),
          eq(modCases.isActive, true)
        )
      )
      .orderBy(desc(modCases.createdAt))
      .limit(perPage)
      .offset((currentPage - 1) * perPage);

    if (warns.length === 0) {
      await interaction.editReply({ content: 'No active warnings in this server.' });
      return;
    }

    const lines = warns.map(w =>
      `**Case #${w.caseNumber}** — <@${w.targetId}> by <@${w.moderatorId}> ${discordTimestamp(w.createdAt, 'R')}\n> ${w.reason}`
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.Warning)
      .setTitle('Server-Wide Active Warnings')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Page ${currentPage}/${totalPages} • ${total} total warnings` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
