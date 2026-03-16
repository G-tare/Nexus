import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getTimer, cancelTimer } from '../helpers';
import { errorReply, successContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('timer-cancel')
  .setDescription('Cancel a timer')
  .addIntegerOption((opt) =>
    opt
      .setName('id')
      .setDescription('The timer ID to cancel')
      .setRequired(true)
      .setMinValue(1)
  );

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const timerId = interaction.options.getInteger('id', true);

  // Get the timer
  const timer = await getTimer(timerId);

  if (!timer) {
    await interaction.reply({
      ...errorReply('Timer Not Found', `No active timer with ID \`${timerId}\` found.`),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if it belongs to the user
  if (timer.userId !== interaction.user.id) {
    await interaction.reply({
      ...errorReply('Not Your Timer', 'You can only cancel your own timers.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if timer is still active
  if (!timer.isActive) {
    await interaction.reply({
      ...errorReply('Timer Already Ended', 'This timer has already ended or been cancelled.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Cancel the timer
  const success = await cancelTimer(timerId);

  if (!success) {
    await interaction.reply({
      ...errorReply('Failed to Cancel Timer', 'An error occurred while cancelling your timer. Please try again.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Send success response
  const container = successContainer('✅ Timer Cancelled', `Cancelled: **${timer.label}**`);
  addFields(container, [{
    name: 'Timer ID',
    value: `\`${timer.id}\``,
    inline: true,
  }]);

  await interaction.reply({
    ...v2Payload([container]),
    flags: MessageFlags.Ephemeral,
  });
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.timer-cancel',
  premiumFeature: 'timers.basic',
  execute,
} as BotCommand;
