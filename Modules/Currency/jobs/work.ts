import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getUserJob, addCurrency, getCurrencyConfig } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Currency');

// Math problems by tier
const MATH_PROBLEMS: Record<number, Array<{ question: string; answer: string }>> = {
  1: [
    { question: '15 + 8 = ?', answer: '23' },
    { question: '12 - 5 = ?', answer: '7' },
    { question: '6 × 4 = ?', answer: '24' },
    { question: '20 ÷ 4 = ?', answer: '5' },
    { question: '7 + 9 = ?', answer: '16' },
  ],
  2: [
    { question: '47 + 28 = ?', answer: '75' },
    { question: '100 - 37 = ?', answer: '63' },
    { question: '12 × 8 = ?', answer: '96' },
    { question: '144 ÷ 12 = ?', answer: '12' },
    { question: '25 + 35 = ?', answer: '60' },
  ],
  3: [
    { question: '156 + 247 = ?', answer: '403' },
    { question: '500 - 168 = ?', answer: '332' },
    { question: '23 × 15 = ?', answer: '345' },
    { question: '256 ÷ 16 = ?', answer: '16' },
    { question: '89 + 76 = ?', answer: '165' },
  ],
  4: [
    { question: '1234 + 5678 = ?', answer: '6912' },
    { question: '2000 - 847 = ?', answer: '1153' },
    { question: '45 × 32 = ?', answer: '1440' },
    { question: '1000 ÷ 25 = ?', answer: '40' },
    { question: '999 + 1001 = ?', answer: '2000' },
  ],
  5: [
    { question: '15² + 8² = ?', answer: '289' },
    { question: '1000 - 234 - 567 = ?', answer: '199' },
    { question: '99 × 11 = ?', answer: '1089' },
    { question: '2401 ÷ 49 = ?', answer: '49' },
    { question: '√256 + √144 = ?', answer: '28' },
  ],
};

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('job-work')
    .setDescription('Work your job to earn coins'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();

      const job = await getUserJob(guildId, userId);

      if (!job) {
        const container = errorContainer('No Job', 'You don\'t have an active job. Use `/job-apply` to get one.');
        return interaction.editReply(v2Payload([container]));
      }

      const db = getDb();
      const tier = Number(job.tier);
      const salary = Number(job.salary);

      // Get a random problem for this tier
      const problems = MATH_PROBLEMS[tier] || MATH_PROBLEMS[1];
      const problem = problems[Math.floor(Math.random() * problems.length)];

      // Create task container
      const taskContainer = moduleContainer('currency');
      addText(taskContainer, `### 📋 Work Task - ${job.name}`);
      addText(taskContainer, `**Question:** ${problem.question}`);
      addFields(taskContainer, [
        { name: 'Answer Format', value: 'Reply to this message with your answer (numbers only)', inline: false }
      ]);

      await interaction.editReply(v2Payload([taskContainer]));

      // Collector for message reply
      const filter = (msg: any) => msg.author.id === userId;
      const collected = await (interaction.channel as TextChannel)
        .awaitMessages({ filter, max: 1, time: 10000 })
        .catch(() => null);

      if (!collected || collected.size === 0) {
        // Timeout - warning
        await db.execute(sql`
          UPDATE user_jobs
          SET warning_count = warning_count + 1,
              last_warning = NOW()
          WHERE guild_id = ${guildId} AND user_id = ${userId} AND is_active = true
        `);

        const timeoutContainer = errorContainer('Task Failed', 'You didn\'t answer in time. +1 Warning');
        return interaction.followUp(v2Payload([timeoutContainer]));
      }

      const answer = collected.first()?.content.trim() || '';

      // Check answer
      const isCorrect = answer.toLowerCase() === problem.answer.toLowerCase();
      const isPartialCredit = !isCorrect && answer.length > 0; // Partial credit for attempting

      let earnedAmount = 0;
      let description = '';

      if (isCorrect) {
        earnedAmount = Math.floor(salary * 1.0); // Full salary
        description = '✅ Perfect! You completed the task correctly!';
        await addCurrency(guildId, userId, 'coins', earnedAmount, 'job_work', { jobId: job.job_id });
      } else if (isPartialCredit) {
        earnedAmount = Math.floor(salary * 0.5); // 50% salary
        description = '⚠️ You tried but got it wrong. 50% pay.';
        await addCurrency(guildId, userId, 'coins', earnedAmount, 'job_work', { jobId: job.job_id });
      } else {
        // No answer - warning
        await db.execute(sql`
          UPDATE user_jobs
          SET warning_count = warning_count + 1,
              last_warning = NOW()
          WHERE guild_id = ${guildId} AND user_id = ${userId} AND is_active = true
        `);
        description = '❌ You didn\'t attempt the task. +1 Warning';
      }

      // Update job stats
      await db.execute(sql`
        UPDATE user_jobs
        SET shifts_completed = shifts_completed + 1,
            total_earned = total_earned + ${earnedAmount},
            promotion_progress = promotion_progress + 5,
            last_shift = NOW(),
            shifts_today = shifts_today + 1
        WHERE guild_id = ${guildId} AND user_id = ${userId} AND is_active = true
      `);

      // Check for warnings
      const jobData = await db.execute(sql`
        SELECT warning_count FROM user_jobs
        WHERE guild_id = ${guildId} AND user_id = ${userId} AND is_active = true
        LIMIT 1
      ` as any);

      const warnings = jobData?.rows[0]?.warning_count ? Number(jobData.rows[0].warning_count) : 0;

      if (warnings >= 3) {
        // Fired
        const config = await getCurrencyConfig(guildId);
        const jobTier = Number(job.tier);
        const newTier = Math.max(1, jobTier - 1);

        await db.execute(sql`
          UPDATE user_jobs
          SET is_active = false,
              fired_at = NOW(),
              fire_reason = 'Too many warnings'
          WHERE guild_id = ${guildId} AND user_id = ${userId}
        `);

        description += `\n\n🔴 You've been **FIRED** for too many warnings! You've been demoted to Tier ${newTier}.`;
      }

      const resultContainer = moduleContainer('currency');
      addText(resultContainer, '### 👷 Work Complete');
      addText(resultContainer, description);
      addFields(resultContainer, [
        { name: 'Correct Answer', value: problem.answer, inline: true },
        { name: 'Your Answer', value: answer || '(no answer)', inline: true },
        { name: 'Earned', value: `${earnedAmount} coins`, inline: true },
        { name: 'Warnings', value: `${warnings}/3`, inline: true }
      ]);

      return interaction.followUp(v2Payload([resultContainer]));
    } catch (error) {
      console.error('[Job Work Error]', error);
      const container = errorContainer('Work Error', 'An error occurred while working.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
