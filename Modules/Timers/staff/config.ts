import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildModuleConfigs } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { moduleContainer, successContainer, errorContainer, addFields, addSeparator, v2Payload, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import { formatDuration, parseDuration } from '../../../Shared/src/utils/time';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { TimerConfig, DEFAULT_TIMER_CONFIG } from '../index';

const logger = createModuleLogger('Timers:Config');

const command = new SlashCommandBuilder()
  .setName('timerconfig')
  .setDescription('Configure timer settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  // ── View ──
  .addSubcommand((sub) =>
    sub.setName('view').setDescription('View current timer configuration')
  )

  // ── Max per user ──
  .addSubcommand((sub) =>
    sub
      .setName('max-per-user')
      .setDescription('Set max timers per user')
      .addIntegerOption((opt) =>
        opt
          .setName('limit')
          .setDescription('Maximum timers per user (1-50)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(50)
      )
  )

  // ── Max duration ──
  .addSubcommand((sub) =>
    sub
      .setName('max-duration')
      .setDescription('Set maximum timer duration')
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Max duration (e.g. 30d, 90d)')
          .setRequired(true)
      )
  )

  // ── Allow DM ──
  .addSubcommand((sub) =>
    sub
      .setName('allow-dm')
      .setDescription('Allow/disallow DM notifications')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Allow DM notifications')
          .setRequired(true)
      )
  )

  // ── Embed color ──
  .addSubcommand((sub) =>
    sub
      .setName('color')
      .setDescription('Set timer embed color')
      .addStringOption((opt) =>
        opt
          .setName('hex')
          .setDescription('Hex color code (e.g. #3498DB)')
          .setRequired(true)
          .setMaxLength(7)
      )
  )

  // ── Log channel ──
  .addSubcommand((sub) =>
    sub
      .setName('log-channel')
      .setDescription('Set log channel for timer events')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel for logs (null to disable)')
          .setRequired(false)
      )
  );

const getTimerConfig = async (guildId: string): Promise<TimerConfig> => {
  const db = getDb();
  try {
    const configRow = await db
      .select()
      .from(guildModuleConfigs)
      .where(
        and(
          eq(guildModuleConfigs.guildId, guildId),
          eq(guildModuleConfigs.module, 'timers')
        )
      );

    if (configRow.length > 0 && configRow[0].config) {
      return { ...DEFAULT_TIMER_CONFIG, ...configRow[0].config } as TimerConfig;
    }
  } catch (error) {
    logger.error(`Failed to get timer config for guild ${guildId}:`, error);
  }

  return DEFAULT_TIMER_CONFIG;
};

const saveTimerConfig = async (guildId: string, config: TimerConfig): Promise<boolean> => {
  const db = getDb();
  try {
    const existing = await db
      .select()
      .from(guildModuleConfigs)
      .where(
        and(
          eq(guildModuleConfigs.guildId, guildId),
          eq(guildModuleConfigs.module, 'timers')
        )
      );

    if (existing.length > 0) {
      await db
        .update(guildModuleConfigs)
        .set({ config })
        .where(eq(guildModuleConfigs.id, existing[0].id));
    } else {
      await db.insert(guildModuleConfigs).values({
        guildId,
        module: 'timers',
        enabled: true,
        config,
      });
    }

    return true;
  } catch (error) {
    logger.error(`Failed to save timer config for guild ${guildId}:`, error);
    return false;
  }
};

const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const subcommand = interaction.options.getSubcommand();
  const config = await getTimerConfig(interaction.guildId!);

  if (subcommand === 'view') {
    const container = moduleContainer('timers');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### ⏱️ Timer Configuration')
    );
    addSeparator(container, 'small');
    addFields(container, [
      {
        name: 'Max per User',
        value: `${config.maxPerUser} timers`,
        inline: true,
      },
      {
        name: 'Max Duration',
        value: formatDuration(config.maxDurationMs),
        inline: true,
      },
      {
        name: 'Allow DM',
        value: config.allowDm ? '✅ Yes' : '❌ No',
        inline: true,
      },
      {
        name: 'Embed Color',
        value: `\`${config.embedColor}\``,
        inline: true,
      },
      {
        name: 'Log Channel',
        value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set',
        inline: true,
      }
    ]);

    await interaction.reply(v2Payload([container]));
    return;
  }

  if (subcommand === 'max-per-user') {
    const limit = interaction.options.getInteger('limit', true);
    config.maxPerUser = limit;

    const success = await saveTimerConfig(interaction.guildId!, config);
    if (!success) {
      await interaction.reply(errorReply('Failed to Save', 'Failed to save configuration.'));
      return;
    }

    await interaction.reply(successReply('Configuration Updated', `Max timers per user: **${limit}**`));
    return;
  }

  if (subcommand === 'max-duration') {
    const durationStr = interaction.options.getString('duration', true);
    const durationMs = parseDuration(durationStr);

    if (!durationMs || durationMs <= 0) {
      await interaction.reply(errorReply('Invalid Duration', 'Please use a valid duration format: `1h`, `30m`, `2d`, etc.'));
      return;
    }

    config.maxDurationMs = durationMs;
    const success = await saveTimerConfig(interaction.guildId!, config);

    if (!success) {
      await interaction.reply(errorReply('Failed to Save', 'Failed to save configuration.'));
      return;
    }

    await interaction.reply(successReply('Configuration Updated', `Max timer duration: **${formatDuration(durationMs)}**`));
    return;
  }

  if (subcommand === 'allow-dm') {
    const enabled = interaction.options.getBoolean('enabled', true);
    config.allowDm = enabled;

    const success = await saveTimerConfig(interaction.guildId!, config);
    if (!success) {
      await interaction.reply(errorReply('Failed to Save', 'Failed to save configuration.'));
      return;
    }

    await interaction.reply(successReply('Configuration Updated', `DM notifications: **${enabled ? '✅ Enabled' : '❌ Disabled'}**`));
    return;
  }

  if (subcommand === 'color') {
    const hexColor = interaction.options.getString('hex', true);

    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(hexColor)) {
      await interaction.reply(errorReply('Invalid Color', 'Please provide a valid hex color code (e.g. #3498DB)'));
      return;
    }

    config.embedColor = hexColor;
    const success = await saveTimerConfig(interaction.guildId!, config);

    if (!success) {
      await interaction.reply(errorReply('Failed to Save', 'Failed to save configuration.'));
      return;
    }

    await interaction.reply(successReply('Configuration Updated', `Embed color: **${hexColor}**`));
    return;
  }

  if (subcommand === 'log-channel') {
    const channel = interaction.options.getChannel('channel');
    config.logChannelId = channel?.id || null;

    const success = await saveTimerConfig(interaction.guildId!, config);
    if (!success) {
      await interaction.reply(errorReply('Failed to Save', 'Failed to save configuration.'));
      return;
    }

    await interaction.reply(successReply('Configuration Updated', `Log channel: ${channel ? `<#${channel.id}>` : '**Disabled**'}`));
    return;
  }
};

export default {
  data: command,
  module: 'timers',
  permissionPath: 'timers.staff.config',
  execute,
} as BotCommand;
