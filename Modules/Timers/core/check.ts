import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getTimer, buildTimerContainer } from '../helpers';
import { errorReply, warningContainer, addFields, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('timer-check')
  .setDescription('Check the time remaining on a timer')
  .addIntegerOption((opt) =>
    opt
      .setName('id')
      .setDescription('The timer ID to check')
      .setRequired(true)
      .setMinValue(1)
  );

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const timerId = interaction.options.getInteger('id', true);

  // Get the timer
  const timer = await getTimer(timerId);

  if (!timer) {
    await interaction.reply({
      ...errorReply('Timer Not Found', `No timer with ID \`${timerId}\` found.`),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if it belongs to the user
  if (timer.userId !== interaction.user.id) {
    await interaction.reply({
      ...errorReply('Not Your Timer', 'You can only check your own timers.'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if timer is still active
  if (!timer.isActive) {
    const container = warningContainer('⏰ Timer Ended', 'This timer has already ended or been cancelled.');
    addSeparator(container, 'small');
    addFields(container, [{
      name: 'Timer Label',
      value: timer.label,
      inline: false,
    }]);

    await interaction.reply({
      ...v2Payload([container]),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Build and send the timer container
  const container = buildTimerContainer(timer);

  await interaction.reply({
    ...v2Payload([container]),
    flags: MessageFlags.Ephemeral,
  });
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.timer-check',
  premiumFeature: 'timers.basic',
  execute,
} as BotCommand;
