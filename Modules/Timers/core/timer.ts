import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createTimer, getUserTimers, getTimerConfig, buildTimerContainer } from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { errorReply, successContainer, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('timer')
  .setDescription('Start a countdown timer')
  .addStringOption((opt) =>
    opt
      .setName('duration')
      .setDescription('Timer duration (e.g. 1h, 30m, 2d)')
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('label')
      .setDescription('What the timer is for')
      .setRequired(true)
      .setMaxLength(200)
  )
  .addBooleanOption((opt) =>
    opt
      .setName('dm')
      .setDescription('Notify via DM instead of channel')
      .setRequired(false)
  );

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const durationStr = interaction.options.getString('duration', true);
  const label = interaction.options.getString('label', true);
  const notifyInDm = interaction.options.getBoolean('dm') ?? false;

  // Parse duration
  const durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs <= 0) {
    await interaction.reply({
      ...errorReply('Invalid Duration', 'Please use a valid duration format: `1h`, `30m`, `2d`, etc.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Get guild config
  const config = await getTimerConfig(interaction.guildId!);

  // Check max duration
  if (durationMs > config.maxDurationMs) {
    await interaction.reply({
      ...errorReply('Duration Too Long', `Maximum timer duration is ${formatDuration(config.maxDurationMs)}.\nYou requested: ${formatDuration(durationMs)}`),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check user's active timers
  const userTimers = await getUserTimers(interaction.guildId!, interaction.user.id);
  if (userTimers.length >= config.maxPerUser) {
    await interaction.reply({
      ...errorReply('Too Many Timers', `You can only have ${config.maxPerUser} active timers at once.\nCancel some with \`/timer-cancel\` to add more.`),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create the timer
  const endsAt = new Date(Date.now() + durationMs);
  const timer = await createTimer({
    guildId: interaction.guildId!,
    userId: interaction.user.id,
    label,
    channelId: notifyInDm ? null : interaction.channelId,
    notifyInDm,
    endsAt,
  });

  if (!timer) {
    await interaction.reply({
      ...errorReply('Failed to Create Timer', 'An error occurred while creating your timer. Please try again.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Send success response
  const container = successContainer('✅ Timer Started', label);
  addFields(container, [
    {
      name: 'Duration',
      value: formatDuration(durationMs),
      inline: true,
    },
    {
      name: 'Notification',
      value: notifyInDm ? 'DM' : 'Channel',
      inline: true,
    },
    {
      name: 'Timer ID',
      value: `\`${timer.id}\``,
      inline: false,
    }
  ]);
  addFooter(container, 'Use /timer-cancel <id> to cancel this timer');

  await interaction.reply({
    ...v2Payload([container]),
    flags: MessageFlags.Ephemeral,
  });
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.timer',
  premiumFeature: 'timers.basic',
  execute,
} as BotCommand;
