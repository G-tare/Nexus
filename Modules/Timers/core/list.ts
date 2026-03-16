import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserTimers, buildTimerContainer } from '../helpers';
import { infoContainer, warningContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('timers')
  .setDescription('List your active timers');

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const userTimers = await getUserTimers(interaction.guildId!, interaction.user.id);

  if (userTimers.length === 0) {
    const container = infoContainer('⏱️ Your Timers', 'You have no active timers. Create one with `/timer`');

    await interaction.reply({
      ...v2Payload([container]),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create containers for each timer (max 10)
  const containers = userTimers.slice(0, 10).map((timer) => buildTimerContainer(timer));

  await interaction.reply({
    ...v2Payload(containers),
    flags: MessageFlags.Ephemeral,
  });

  // If more than 10, add a note
  if (userTimers.length > 10) {
    const noteContainer = warningContainer('⚠️ Too Many Timers to Display', `You have ${userTimers.length} active timers. Showing the first 10.`);

    await interaction.followUp({
      ...v2Payload([noteContainer]),
      flags: MessageFlags.Ephemeral,
    });
  }
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.timers',
  premiumFeature: 'timers.basic',
  execute,
} as BotCommand;
