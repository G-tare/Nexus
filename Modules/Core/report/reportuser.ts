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

const logger = createModuleLogger('Core:Report User');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('report-user')
    .setDescription('Report a user for misconduct')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('User to report')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the report')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('evidence')
        .setDescription('Description or link to evidence (optional)')
        .setRequired(false)
    ),

  module: 'core',
  permissionPath: 'core.report.user',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const targetUser = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      const evidence = interaction.options.getString('evidence');

      if (targetUser.id === interaction.user.id) {
        await interaction.editReply({
          content: '❌ You cannot report yourself.',
        });
        return;
      }

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

      // Create report in database
      const newReport = await db
        .insert(reports)
        .values({
          guildId,
          reportNumber: nextReportNumber,
          reporterId: interaction.user.id,
          type: 'user',
          targetId: targetUser.id,
          description: reason,
          evidence: evidence || null,
          status: 'open',
        })
        .returning();

      const report = newReport[0];

      // Send confirmation to reporter
      const confirmContainer = successContainer('Report Submitted', 'Your report has been submitted to staff');
      addFields(confirmContainer, [
        {
          name: 'Report ID',
          value: `#${report.reportNumber}`,
          inline: true,
        },
        {
          name: 'Target User',
          value: `${targetUser.username}`,
          inline: true,
        },
        {
          name: 'Reason',
          value: reason,
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
            new TextDisplayBuilder().setContent(`### 📋 New User Report #${report.reportNumber}`),
          );
          addSeparator(staffContainer, 'small');
          addFields(staffContainer, [
            {
              name: 'Reported User',
              value: `${targetUser} (${targetUser.id})`,
              inline: true,
            },
            {
              name: 'Reporter',
              value: `${interaction.user} (${interaction.user.id})`,
              inline: true,
            },
            {
              name: 'Reason',
              value: reason,
              inline: false,
            },
            {
              name: 'Evidence',
              value: evidence || 'None provided',
              inline: false,
            },
          ]);
          addFooter(staffContainer, `Report #${report.reportNumber}`);

          await reportChannel.send(v2Payload([staffContainer]));
        }
      }
    } catch (error) {
      logger.error('Error in report user command:', error);
      await interaction.editReply({
        content: 'An error occurred while submitting your report.',
      });
    }
  },
};

export default command;
