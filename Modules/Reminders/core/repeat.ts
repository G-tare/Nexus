import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createReminder, parseDuration, formatDuration, generateReminderId } from '../helpers';
import { getRedis } from '../../../Shared/src/database/connection';

const command = new SlashCommandBuilder()
  .setName('remind-repeat')
  .setDescription('Set a recurring reminder')
  .addStringOption((opt) =>
    opt
      .setName('interval')
      .setDescription('How often to repeat (e.g., "1h", "1d", "1w")')
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
  const redis = await getRedis();

  const intervalStr = interaction.options.getString('interval', true);
  const message = interaction.options.getString('message', true);
  const dmOption = interaction.options.getBoolean('dm') ?? true;

  // Parse interval
  const interval = parseDuration(intervalStr);
  if (!interval || interval <= 0) {
    await interaction.reply({
      content: '❌ Invalid interval format. Use "1h", "1d", "1w", etc.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Validate limits: 1 hour min, 30 days max
  const ONE_HOUR = 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  if (interval < ONE_HOUR) {
    await interaction.reply({
      content: '❌ Minimum interval is 1 hour.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interval > THIRTY_DAYS) {
    await interaction.reply({
      content: '❌ Maximum interval is 30 days.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check reminder limit
  const userReminders = await redis.smembers(`user:${interaction.user.id}:reminders`);
  if (userReminders.length >= 25) {
    await interaction.reply({
      content: '❌ You already have 25 active reminders. Cancel some before adding more.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Create recurring reminder
  const triggerAt = new Date(Date.now() + interval);

  const reminder = await createReminder(redis, {
    id: generateReminderId(),
    userId: interaction.user.id,
    guildId: interaction.guildId! || undefined,
    channelId: interaction.channelId!,
    message,
    triggerAt,
    createdAt: new Date(),
    recurring: true,
    interval,
    dmFallback: dmOption,
  });

  // Reply
  const embed = new EmbedBuilder()
    .setColor('#57F287')
    .setTitle('✅ Recurring Reminder Set')
    .setDescription(message)
    .addFields(
      {
        name: 'Interval',
        value: formatDuration(interval),
        inline: true,
      },
      {
        name: 'First Fires At',
        value: `<t:${Math.floor(triggerAt.getTime() / 1000)}:f>`,
        inline: true,
      },
      {
        name: 'ID',
        value: `\`${reminder.id}\``,
        inline: true,
      }
    )
    .setFooter({ text: 'Use /reminder-cancel <id> to stop the recurring reminder' })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
};

export default {
  data: command,
  module: 'reminders',
  permissionPath: 'reminders.remind-repeat',
  premiumFeature: 'reminders.advanced',
  execute,
} as BotCommand;
