import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getUserJob, getAvailableJobs, ensureDefaultJobs } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('job-apply')
    .setDescription('Apply for a job')
    .addStringOption((opt) =>
      opt.setName('jobname').setDescription('Name of the job to apply for').setRequired(true).setAutocomplete(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const jobName = interaction.options.getString('jobname', true);

      await interaction.deferReply();

      // Check for existing job
      const existingJob = await getUserJob(guildId, userId);
      if (existingJob) {
        const container = errorContainer('Already Employed', `You already have an active job: **${existingJob.name}**. Quit first to apply for another.`);
        return interaction.editReply(v2Payload([container]));
      }

      // Get available jobs
      await ensureDefaultJobs(guildId);
      const availableJobs = await getAvailableJobs(guildId);

      // Find requested job
      const job = availableJobs.find((j: any) => j.name.toLowerCase() === jobName.toLowerCase());

      if (!job) {
        const container = errorContainer('Job Not Found', `Job **${jobName}** not found. Use /job-list to see available jobs.`);
        return interaction.editReply(v2Payload([container]));
      }

      const db = getDb();

      // Check if user has a previous job record to determine tier progression
      const previousJob = await db.execute(sql`
        SELECT tier, promotion_progress FROM user_jobs
        WHERE guild_id = ${guildId} AND user_id = ${userId}
        ORDER BY hired_at DESC
        LIMIT 1
      ` as any);

      const userTier = previousJob?.rows[0]?.tier ? Number(previousJob.rows[0].tier) : 0;
      const jobTier = Number(job.tier);

      // Tier 1 is always available, higher tiers require progression
      if (jobTier > 1) {
        if (userTier < jobTier - 1) {
          const container = errorContainer('Tier Locked', `You need to reach Tier ${jobTier - 1} first. Your current tier: ${Math.max(1, userTier)}`);
          return interaction.editReply(v2Payload([container]));
        }

        // Check promotion progress if at same tier
        if (userTier === jobTier - 1) {
          const promotionProgress = previousJob?.rows[0]?.promotion_progress ? Number(previousJob.rows[0].promotion_progress) : 0;
          if (promotionProgress < 50) {
            const container = errorContainer('Promotion Not Ready', `You need ${50 - promotionProgress} more promotion points. Current: ${promotionProgress}/50`);
            return interaction.editReply(v2Payload([container]));
          }
        }
      }

      // Create job application
      const now = new Date();
      await db.execute(sql`
        INSERT INTO user_jobs (
          guild_id, user_id, job_id, tier, salary, hired_at, is_active, shifts_completed, total_earned, warning_count
        ) VALUES (
          ${guildId}, ${userId}, ${job.job_id}, ${jobTier}, ${job.salary}, ${now.toISOString()}, true, 0, 0, 0
        )
      `);

      const container = moduleContainer('currency');
      addText(container, '### 🎉 Job Application Accepted!');
      addText(container, `You've been hired as a **${job.name}**!`);
      addFields(container, [
        { name: 'Position', value: `${job.emoji} ${job.name}`, inline: true },
        { name: 'Tier', value: `${jobTier}`, inline: true },
        { name: 'Salary per Shift', value: `${job.salary} coins`, inline: true },
        { name: 'Next Steps', value: 'Use `/job-work` to start working and earn coins!', inline: false }
      ]);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Job Apply Error]', error);
      const container = errorContainer('Job Application Error', 'An error occurred while applying for a job.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
