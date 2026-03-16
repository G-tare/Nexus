import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { reports } from '../../../Shared/src/database/models/schema';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import {
  successContainer,
  moduleContainer,
  addSeparator,
  addFields,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { eq } from 'drizzle-orm';

const logger = createModuleLogger('Core:Report Bug');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('report-bug')
    .setDescription('Report a bug in the bot')
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Description of the bug')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('evidence')
        .setDescription('Description or screenshot of the bug (optional)')
        .setRequired(false)
    ),

  module: 'core',
  permissionPath: 'core.report.bug',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const description = interaction.options.getString('description', true);
      const evidence = interaction.options.getString('evidence');

      // Get report channel from config
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'core');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;
      const reportChannelId = config.reportChannelId;

      // Get next report number
      const db = await getDb();
      const lastReport = await db.query.reports.findFirst({
        where: (table) => eq(table.guildId, guildId),
        orderBy: (table) => table.reportNumber,
      });

      const nextReportNumber = (lastReport?.reportNumber || 0) + 1;

      // Create bug report in database
      const newReport = await db
        .insert(reports)
        .values({
          guildId,
          reportNumber: nextReportNumber,
          reporterId: interaction.user.id,
          type: 'bug',
          targetId: null,
          description,
          evidence: evidence || null,
          status: 'open',
        })
        .returning();

      const report = newReport[0];

      // Send confirmation to reporter
      const confirmContainer = successContainer('Bug Report Submitted', 'Your bug report has been submitted to developers');
      addFields(confirmContainer, [
        {
          name: 'Report ID',
          value: `#${report.reportNumber}`,
          inline: true,
        },
        {
          name: 'Type',
          value: 'Bug Report',
          inline: true,
        },
        {
          name: 'Description',
          value: description,
          inline: false,
        },
      ]);
      addFooter(confirmContainer, `Submitted at ${new Date().toLocaleString()}`);

      await interaction.editReply(v2Payload([confirmContainer]));

      // Send to report channel if configured
      if (reportChannelId) {
        const reportChannel = interaction.guild?.channels.cache.get(reportChannelId);

        if (reportChannel?.isTextBased()) {
          const staffContainer = moduleContainer('core');
          staffContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🐛 New Bug Report #${report.reportNumber}`),
          );
          addSeparator(staffContainer, 'small');
          addFields(staffContainer, [
            {
              name: 'Reporter',
              value: `${interaction.user} (${interaction.user.id})`,
              inline: true,
            },
            {
              name: 'Reported At',
              value: new Date().toLocaleString(),
              inline: true,
            },
            {
              name: 'Description',
              value: description,
              inline: false,
            },
            {
              name: 'Details',
              value: evidence || 'None provided',
              inline: false,
            },
          ]);
          addFooter(staffContainer, `Report #${report.reportNumber}`);

          await reportChannel.send(v2Payload([staffContainer]));
        }
      }
    } catch (error) {
      logger.error('Error in report bug command:', error);
      await interaction.editReply({
        content: 'An error occurred while submitting your bug report.',
      });
    }
  },
};

export default command;
