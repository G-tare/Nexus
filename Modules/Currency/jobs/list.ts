import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  moduleContainer,
  addText,
  addFields,
  addSeparator,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getAvailableJobs, ensureDefaultJobs } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('job-list')
    .setDescription('View all available jobs'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;

      await interaction.deferReply();

      // Ensure default jobs exist
      await ensureDefaultJobs(guildId);

      // Get all jobs
      const allJobs = await getAvailableJobs(guildId);

      if (!allJobs || allJobs.length === 0) {
        const container = moduleContainer('currency');
        addText(container, '### 📋 Available Jobs');
        addText(container, 'No jobs available.');
        return interaction.editReply(v2Payload([container]));
      }

      // Group jobs by tier
      const jobsByTier: Record<number, any[]> = {};
      for (const job of allJobs) {
        const tier = Number(job.tier);
        if (!jobsByTier[tier]) jobsByTier[tier] = [];
        jobsByTier[tier].push(job);
      }

      const container = moduleContainer('currency');
      addText(container, '### 📋 Available Jobs');
      addText(container, 'Browse and apply for jobs! Use `/job-apply` to apply.');
      addSeparator(container, 'small');

      // Add jobs by tier
      for (let tier = 1; tier <= 5; tier++) {
        if (jobsByTier[tier]) {
          const jobs = jobsByTier[tier];
          const jobList = jobs
            .map((j: any) => `${j.emoji} **${j.name}** - ${j.salary} coins/shift`)
            .join('\n');

          addFields(container, [
            { name: `⭐ Tier ${tier}`, value: jobList, inline: false }
          ]);
        }
      }

      addSeparator(container, 'small');
      addText(container, '**How to Apply:**\nUse `/job-apply <jobname>` to apply for a job. For example: `/job-apply Developer`');

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Job List Error]', error);
      const container = moduleContainer('currency');
      addText(container, '### ❌ Error');
      addText(container, 'An error occurred while fetching the job list.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
