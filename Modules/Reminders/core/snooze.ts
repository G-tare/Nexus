import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { snoozeReminder, parseDuration, formatDuration, getReminder } from '../helpers';
import { getRedis } from '../../../Shared/src/database/connection';

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
  const redis = await getRedis();

  const reminderId = interaction.options.getString('id', true);
  const timeStr = interaction.options.getString('time') || '10m';

  // Parse duration
  const duration = parseDuration(timeStr);
  if (!duration || duration <= 0) {
    await interaction.reply({
      content: '❌ Invalid time format. Use "30m", "2h", "1d", "1w", or "tomorrow".',
      ephemeral: true,
    });
    return;
  }

  // Snooze the reminder
  const snoozed = await snoozeReminder(redis, reminderId, interaction.user.id, duration);

  if (!snoozed) {
    await interaction.reply({
      content: '❌ Reminder not found or does not belong to you.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⏰ Reminder Snoozed')
    .setDescription(`Snoozed for ${formatDuration(duration)}`)
    .addFields({
      name: 'New Fire Time',
      value: `<t:${Math.floor(snoozed.triggerAt.getTime() / 1000)}:f>`,
      inline: false,
    })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.snooze',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
