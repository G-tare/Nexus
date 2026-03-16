import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGuildTimers } from '../helpers';
import { moduleContainer, addText, addFields, addSeparator, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { discordTimestamp, formatDuration } from '../../../Shared/src/utils/time';

const command = new SlashCommandBuilder()
  .setName('timers-list')
  .setDescription('List all active timers in the server (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const guildTimers = await getGuildTimers(interaction.guildId!);

  if (guildTimers.length === 0) {
    const container = moduleContainer('timers');
    addText(container, '### ⏱️ Server Timers\nThere are no active timers in this server.');
    await interaction.reply(v2Payload([container]));
    return;
  }

  // Group timers by user for readability
  const timersByUser: Record<string, typeof guildTimers> = {};
  for (const timer of guildTimers) {
    if (!timersByUser[timer.userId]) {
      timersByUser[timer.userId] = [];
    }
    timersByUser[timer.userId].push(timer);
  }

  // Create containers - max 20 fields per container
  const containers = [];
  let currentContainer = moduleContainer('timers');
  addText(currentContainer, `### ⏱️ Server Timers\nTotal: ${guildTimers.length} active timer${guildTimers.length !== 1 ? 's' : ''}`);
  addSeparator(currentContainer, 'small');

  let fieldCount = 0;
  const maxFieldsPerContainer = 20;

  for (const [userId, userTimers] of Object.entries(timersByUser)) {
    for (const timer of userTimers) {
      const duration = timer.endsAt.getTime() - timer.startsAt.getTime();
      const timeRemaining = timer.endsAt.getTime() - Date.now();

      const fieldValue = `**${timer.label}**\n` +
        `Duration: ${formatDuration(duration)}\n` +
        `Remaining: ${timeRemaining > 0 ? formatDuration(timeRemaining) : '(Expired)'}\n` +
        `Ends: ${discordTimestamp(timer.endsAt)}\n` +
        `Channel: ${timer.channelId ? `<#${timer.channelId}>` : 'DM'}`;

      if (fieldCount >= maxFieldsPerContainer) {
        containers.push(currentContainer);
        currentContainer = moduleContainer('timers');
        addText(currentContainer, '### ⏱️ Server Timers (continued)');
        addSeparator(currentContainer, 'small');
        fieldCount = 0;
      }

      addFields(currentContainer, [{
        name: `<@${userId}> (ID: ${timer.id})`,
        value: fieldValue,
        inline: false,
      }]);

      fieldCount++;
    }
  }

  // Add the last container
  if (fieldCount > 0) {
    containers.push(currentContainer);
  }

  // Add footer to last container
  addFooter(containers[containers.length - 1], `${new Date().toLocaleString()}`);

  // Send first container
  await interaction.reply(v2Payload([containers[0]]));

  // Send remaining containers as follow-ups
  for (let i = 1; i < containers.length; i++) {
    await interaction.followUp(v2Payload([containers[i]]));
  }
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.manage.serverlist',
  execute,
} as BotCommand;
