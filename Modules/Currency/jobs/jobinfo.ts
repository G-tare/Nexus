import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addSectionWithThumbnail,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getUserJob } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('job-info')
    .setDescription('View your current job information'),

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

      const tier = Number(job.tier);
      const salary = Number(job.salary);
      const shiftsCompleted = Number(job.shifts_completed || 0);
      const totalEarned = Number(job.total_earned || 0);
      const warnings = Number(job.warning_count || 0);
      const promotionProgress = Number(job.promotion_progress || 0);

      // Create progress bar
      const progressBar = promotionProgress >= 50
        ? '█████████████████████ (100%)'
        : '█'.repeat(Math.floor(promotionProgress / 5)) + '░'.repeat(20 - Math.floor(promotionProgress / 5)) + ` (${promotionProgress}%)`;

      // Warning status
      let warningStatus = '';
      if (warnings === 0) warningStatus = '✅ No warnings';
      else if (warnings === 1) warningStatus = '⚠️ 1 warning';
      else if (warnings === 2) warningStatus = '⚠️⚠️ 2 warnings';
      else warningStatus = '🔴 3 warnings (FIRED!)';

      const container = moduleContainer('currency');
      addSectionWithThumbnail(
        container,
        `### ${job.emoji} ${job.name}`,
        interaction.user.displayAvatarURL()
      );
      addFields(container, [
        { name: 'Tier', value: `${tier}`, inline: true },
        { name: 'Salary per Shift', value: `${salary} coins`, inline: true },
        { name: 'Shifts Completed', value: shiftsCompleted.toString(), inline: true },
        { name: 'Total Earned', value: `${totalEarned.toLocaleString()} coins`, inline: true },
        { name: 'Warnings', value: warningStatus, inline: true },
        { name: 'Next Promotion', value: `${50 - Math.min(50, promotionProgress)} points needed`, inline: true },
        { name: 'Promotion Progress', value: progressBar, inline: false }
      ]);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Job Info Error]', error);
      const container = errorContainer('Job Info Error', 'An error occurred while fetching job information.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
