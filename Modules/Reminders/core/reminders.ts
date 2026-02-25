import {  ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserReminders, buildReminderListEmbed } from '../helpers';
import { getRedis } from '../../../Shared/src/database/connection';

const command = new SlashCommandBuilder()
  .setName('reminders')
  .setDescription('View all your active reminders');

const execute = async (interaction: ChatInputCommandInteraction, ...args: any[]): Promise<void> => {
  const redis = await getRedis();

  const reminders = await getUserReminders(redis, interaction.user.id);

  const embed = buildReminderListEmbed(reminders);

  await interaction.reply({
    embeds: [embed],
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
