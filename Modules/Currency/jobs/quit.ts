import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addButtons,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { getUserJob } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.jobs',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('job-quit')
    .setDescription('Quit your current job'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();

      const job = await getUserJob(guildId, userId);

      if (!job) {
        const container = errorContainer('No Job', 'You don\'t have an active job.');
        return interaction.editReply(v2Payload([container]));
      }

      // Confirmation buttons
      const buttons = [
        new ButtonBuilder()
          .setCustomId('confirm_quit')
          .setLabel('Yes, Quit')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancel_quit')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      ];

      const container = moduleContainer('currency');
      addText(container, '### Are you sure?');
      addText(container, `Are you sure you want to quit your job as **${job.name}**?\n\nYou can apply for another job anytime.`);
      addButtons(container, buttons);

      const response = await interaction.editReply(v2Payload([container]));

      // Collector
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        filter: (i) => i.user.id === userId,
      });

      let collected = false;

      collector.on('collect', async (buttonInteraction) => {
        collected = true;
        collector.stop();

        if (buttonInteraction.customId === 'cancel_quit') {
          const cancelContainer = moduleContainer('currency');
          addText(cancelContainer, '### Cancelled');
          addText(cancelContainer, 'You decided to keep your job.');

          return buttonInteraction.update(v2Payload([cancelContainer]));
        }

        // Quit the job
        const db = getDb();
        const totalEarned = Number(job.total_earned || 0);

        await db.execute(sql`
          UPDATE user_jobs
          SET is_active = false
          WHERE guild_id = ${guildId} AND user_id = ${userId} AND is_active = true
        `);

        const quitContainer = moduleContainer('currency');
        addText(quitContainer, `### Left ${job.name}`);
        addText(quitContainer, 'You\'ve quit your job.');
        addFields(quitContainer, [
          { name: 'Total Earned', value: `${totalEarned.toLocaleString()} coins`, inline: true }
        ]);

        return buttonInteraction.update(v2Payload([quitContainer]));
      });

      collector.on('end', async (_, reason) => {
        if (!collected && reason === 'time') {
          const timeoutContainer = errorContainer('Quit Cancelled', 'You took too long to respond.');

          try {
            await response.edit(v2Payload([timeoutContainer]));
          } catch {
            // Message already deleted
          }
        }
      });
    } catch (error) {
      console.error('[Job Quit Error]', error);
      const container = errorContainer('Quit Error', 'An error occurred while quitting your job.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
