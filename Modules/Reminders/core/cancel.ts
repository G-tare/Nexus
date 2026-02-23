import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { cancelReminder, getReminder } from '../helpers';
import { getRedis } from '../../../Shared/src/database/connection';

const command = new SlashCommandBuilder()
  .setName('reminder-cancel')
  .setDescription('Cancel a reminder by ID')
  .addStringOption((opt) =>
    opt
      .setName('id')
      .setDescription('The ID of the reminder to cancel')
      .setRequired(true)
      .setAutocomplete(true)
  );

const execute = async (interaction: ChatInputCommandInteraction, ...args: any[]): Promise<void> => {
  const redis = await getRedis();

  const reminderId = interaction.options.getString('id', true);

  // Verify the reminder exists and belongs to the user
  const reminder = await getReminder(redis, reminderId);
  if (!reminder || reminder.userId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ Reminder not found or does not belong to you.',
      ephemeral: true,
    });
    return;
  }

  // Cancel it
  const success = await cancelReminder(redis, reminderId, interaction.user.id);

  if (!success) {
    await interaction.reply({
      content: '❌ Failed to cancel reminder.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('✅ Reminder Cancelled')
    .setDescription(`Cancelled reminder \`${reminderId}\`: "${reminder.message}"`)
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.reminder-cancel',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
