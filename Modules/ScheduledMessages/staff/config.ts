import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('scheduleconfig')
    .setDescription('Configure scheduled messages module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View current scheduled messages configuration')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Update scheduled messages configuration')
        .addStringOption((option) =>
          option
            .setName('setting')
            .setDescription('Configuration setting to update')
            .setRequired(true)
            .addChoices(
              { name: 'enabled', value: 'enabled' },
              { name: 'maxScheduledPerGuild', value: 'maxScheduledPerGuild' },
              { name: 'timezone', value: 'timezone' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('value')
            .setDescription('New value for the setting')
            .setRequired(true)
        )
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.config',
  defaultPermissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;
      const db = (interaction.client as any).db;

      if (!db) {
        return await interaction.editReply('❌ Database not available.');
      }

      if (subcommand === 'view') {
        // Fetch current config
        let configResult = await db.query(
          'SELECT * FROM scheduledMessagesConfig WHERE guildId = $1',
          [guildId]
        );

        let config = configResult.rows?.[0];

        // Create default if not found
        if (!config) {
          config = {
            guildId,
            enabled: true,
            maxScheduledPerGuild: 25,
            timezone: 'UTC',
          };
        }

        const container = moduleContainer('scheduled_messages');
        addText(container, '### Scheduled Messages Configuration');
        addText(container, `**Enabled**\n${config.enabled ? '✅ Yes' : '❌ No'}`);
        addText(container, `**Max Per Guild**\n${config.maxScheduledPerGuild?.toString() ?? '25'}`);
        addText(container, `**Timezone**\n${config.timezone ?? 'UTC'}`);
        addText(container, `-# Use /scheduleconfig set to update settings`);

        await interaction.editReply(v2Payload([container]));
      } else if (subcommand === 'set') {
        const setting = interaction.options.getString('setting', true);
        const value = interaction.options.getString('value', true);

        // Validate and update
        if (setting === 'enabled') {
          if (!['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
            return await interaction.editReply('❌ Invalid value for enabled. Use true/false, yes/no, or 1/0.');
          }

          const enabled = ['true', 'yes', '1'].includes(value.toLowerCase());

          await db.query(
            `INSERT INTO scheduledMessagesConfig (guildId, enabled, createdAt, updatedAt)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (guildId) DO UPDATE SET enabled = $2, updatedAt = NOW()`,
            [guildId, enabled]
          );

          const container = moduleContainer('scheduled_messages');
          container.setAccentColor(0x00aa00);
          addText(container, '### Config Updated');
          addText(container, `**enabled**\n${enabled ? '✅ Yes' : '❌ No'}`);

          await interaction.editReply(v2Payload([container]));
        } else if (setting === 'maxScheduledPerGuild') {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > 1000) {
            return await interaction.editReply('❌ Invalid value. Must be a number between 1 and 1000.');
          }

          await db.query(
            `INSERT INTO scheduledMessagesConfig (guildId, maxScheduledPerGuild, createdAt, updatedAt)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (guildId) DO UPDATE SET maxScheduledPerGuild = $2, updatedAt = NOW()`,
            [guildId, num]
          );

          const container = moduleContainer('scheduled_messages');
          container.setAccentColor(0x00aa00);
          addText(container, '### Config Updated');
          addText(container, `**maxScheduledPerGuild**\n${num.toString()}`);

          await interaction.editReply(v2Payload([container]));
        } else if (setting === 'timezone') {
          // Validate timezone
          const validTimezones = [
            'UTC', 'EST', 'CST', 'MST', 'PST',
            'GMT', 'CET', 'IST', 'JST', 'AEST',
          ];

          if (!validTimezones.includes(value.toUpperCase())) {
            return await interaction.editReply(
              `❌ Invalid timezone. Valid options: ${validTimezones.join(', ')}`
            );
          }

          await db.query(
            `INSERT INTO scheduledMessagesConfig (guildId, timezone, createdAt, updatedAt)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (guildId) DO UPDATE SET timezone = $2, updatedAt = NOW()`,
            [guildId, value.toUpperCase()]
          );

          const container = moduleContainer('scheduled_messages');
          container.setAccentColor(0x00aa00);
          addText(container, '### Config Updated');
          addText(container, `**timezone**\n${value.toUpperCase()}`);

          await interaction.editReply(v2Payload([container]));
        }

        logger.info(`[ScheduledMessages] Updated config for guild ${guildId}: ${setting} = ${value}`);
      }
    } catch (error) {
      logger.error('[ScheduledMessages] Error in scheduleconfig command:', error);
      await interaction.editReply({ content: '❌ An error occurred while updating configuration.' });
    }
  },
};

export default command;
