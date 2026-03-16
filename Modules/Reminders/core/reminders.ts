import {  ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserReminders, buildReminderListContainer } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('reminders')
  .setDescription('View all your active reminders');

const execute = async (interaction: ChatInputCommandInteraction, ...args: any[]): Promise<void> => {
  const reminders = await getUserReminders(interaction.user.id);

  const container = buildReminderListContainer(reminders);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral,
  });
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.reminders',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
