import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { V2Colors, addText, addFooter, moduleContainer } from '../../../Shared/src/utils/componentsV2';
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

    await interaction.deferReply({});

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

    const container = moduleContainer('moderation');
    addText(container, `### Server-Wide Active Warnings\n${lines.join('\n\n')}`);
    addFooter(container, `Page ${currentPage}/${totalPages} • ${total} total warnings`);

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
