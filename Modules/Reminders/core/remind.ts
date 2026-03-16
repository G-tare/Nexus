import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createReminder, getUserReminders, parseDuration, formatDuration } from '../helpers';
import { successContainer, errorReply, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Set a reminder for a specific time')
  .addStringOption((opt) =>
    opt
      .setName('time')
      .setDescription('When to remind you (e.g., "30m", "2h", "1d", "tomorrow")')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('message')
      .setDescription('What to remind you about')
      .setRequired(true)
      .setMaxLength(500)
  )
  .addBooleanOption((opt) =>
    opt
      .setName('dm')
      .setDescription('Send as DM when fired (default: true)')
      .setRequired(false)
  );

const execute = async (interaction: ChatInputCommandInteraction, ...args: any[]): Promise<void> => {
  const timeStr = interaction.options.getString('time', true);
  const message = interaction.options.getString('message', true);
  const dmOption = interaction.options.getBoolean('dm') ?? true;

  // Parse duration
  const duration = parseDuration(timeStr);
  if (!duration || duration <= 0) {
    await interaction.reply(errorReply('Invalid time format', 'Use "30m", "2h", "1d", "1w", or "tomorrow".'));
    return;
  }

  // Check reminder limit
  const userReminders = await getUserReminders(interaction.user.id);
  if (userReminders.length >= 25) {
    await interaction.reply(errorReply('Reminder limit reached', 'You already have 25 active reminders. Cancel some before adding more.'));
    return;
  }

  // Create reminder
  const triggerAt = new Date(Date.now() + duration);

  const reminder = await createReminder(interaction.client, {
    id: '', // Ignored; DB generates the ID
    userId: interaction.user.id,
    guildId: interaction.guildId! || undefined,
    channelId: interaction.channelId!,
    message,
    triggerAt,
    createdAt: new Date(),
    recurring: false,
    dmFallback: dmOption,
  });

  // Reply
  const container = successContainer('✅ Reminder Set', message);
  addFields(container, [
    {
      name: 'In',
      value: formatDuration(duration),
      inline: true,
    },
    {
      name: 'Fires At',
      value: `<t:${Math.floor(triggerAt.getTime() / 1000)}:f>`,
      inline: true,
    },
    {
      name: 'ID',
      value: `\`${reminder.id}\``,
      inline: true,
    }
  ]);
  addText(container, `-# Use /reminder-cancel <id> to cancel`);

  await interaction.reply(v2Payload([container]));
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.remind',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
