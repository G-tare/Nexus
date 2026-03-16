import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('job-leaderboard')
    .setDescription('View job earnings leaderboard'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;

      await interaction.deferReply();

      const db = getDb();
      const topEarners = await db.execute(sql`
        SELECT
          uj.user_id,
          uj.total_earned,
          uj.shifts_completed,
          jl.name,
          jl.emoji
        FROM user_jobs uj
        LEFT JOIN job_listings jl ON uj.guild_id = jl.guild_id AND uj.job_id = jl.job_id
        WHERE uj.guild_id = ${guildId}
        ORDER BY uj.total_earned DESC
        LIMIT 10
      ` as any);

      if (!topEarners || topEarners.rows.length === 0) {
        const container = moduleContainer('currency');
        addText(container, '### 👷 Job Earnings Leaderboard');
        addText(container, 'No job records found yet.');
        return interaction.editReply(v2Payload([container]));
      }

      let leaderboard = '';
      for (let i = 0; i < topEarners.rows.length; i++) {
        const earner = topEarners.rows[i] as any;
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const totalEarned = Number(earner.total_earned || 0);
        const shiftsCompleted = Number(earner.shifts_completed || 0);
        const jobName = earner.name || 'Unknown Job';
        const jobEmoji = earner.emoji || '👷';

        leaderboard += `${medal} <@${earner.user_id}> - **${totalEarned.toLocaleString()}** coins (${shiftsCompleted} shifts) ${jobEmoji} ${jobName}\n`;
      }

      const container = moduleContainer('currency');
      addText(container, '### 👷 Job Earnings Leaderboard');
      addText(container, leaderboard || 'No data available.');

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Job Leaderboard Error]', error);
      const container = errorContainer('Leaderboard Error', 'An error occurred while fetching the leaderboard.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
