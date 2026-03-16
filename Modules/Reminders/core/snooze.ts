import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { snoozeReminder, parseDuration, formatDuration } from '../helpers';
import { moduleContainer, errorReply, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('snooze')
  .setDescription('Snooze a recently fired reminder')
  .addStringOption((opt) =>
    opt
      .setName('id')
      .setDescription('The ID of the reminder to snooze')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('time')
      .setDescription('How long to snooze for (default: 10m)')
      .setRequired(false)
  );

const execute = async (interaction: ChatInputCommandInteraction, ...args: any[]): Promise<void> => {
  const reminderId = interaction.options.getString('id', true);
  const timeStr = interaction.options.getString('time') || '10m';

  // Parse duration
  const duration = parseDuration(timeStr);
  if (!duration || duration <= 0) {
    await interaction.reply(errorReply('Invalid time format', 'Use "30m", "2h", "1d", "1w", or "tomorrow".'));
    return;
  }

  // Snooze the reminder
  const snoozed = await snoozeReminder(interaction.client, reminderId, interaction.user.id, duration);

  if (!snoozed) {
    await interaction.reply(errorReply('Not found', 'Reminder not found or does not belong to you.'));
    return;
  }

  const container = moduleContainer('reminders');
  addText(container, `### ⏰ Reminder Snoozed\nSnoozed for ${formatDuration(duration)}`);
  addFields(container, [
    {
      name: 'New Fire Time',
      value: `<t:${Math.floor(snoozed.triggerAt.getTime() / 1000)}:f>`,
      inline: false,
    }
  ]);

  await interaction.reply(v2Payload([container]));
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.snooze',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
