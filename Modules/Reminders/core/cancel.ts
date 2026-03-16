import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { cancelReminder, getReminder } from '../helpers';
import { errorContainer, errorReply, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
  const reminderId = interaction.options.getString('id', true);

  // Verify the reminder exists and belongs to the user
  const reminder = await getReminder(reminderId);
  if (!reminder || reminder.userId !== interaction.user.id) {
    await interaction.reply(errorReply('Not found', 'Reminder not found or does not belong to you.'));
    return;
  }

  // Cancel it
  const success = await cancelReminder(reminderId, interaction.user.id);

  if (!success) {
    await interaction.reply(errorReply('Cancellation failed', 'Failed to cancel reminder.'));
    return;
  }

  const container = errorContainer('✅ Reminder Cancelled', `Cancelled reminder \`${reminderId}\`: "${reminder.message}"`);

  await interaction.reply(v2Payload([container]));
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.reminder-cancel',
  premiumFeature: 'reminders.basic',
  execute,
} as BotCommand;
