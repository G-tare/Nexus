import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

export default {
  module: 'automod',
  permissionPath: 'automod.staff.antispam',
  premiumFeature: 'automod.basic',
  permissions: [PermissionFlagsBits.ManageGuild],

  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure anti-spam detection settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable anti-spam detection')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable anti-spam')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('rate')
        .setDescription('Set the message rate limit for spam detection')
        .addIntegerOption(opt =>
          opt
            .setName('messages')
            .setDescription('Max messages allowed')
            .setMinValue(2)
            .setMaxValue(20)
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('seconds')
            .setDescription('Time window in seconds')
            .setMinValue(3)
            .setMaxValue(30)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('duplicates')
        .setDescription('Set duplicate message threshold')
        .addIntegerOption(opt =>
          opt
            .setName('threshold')
            .setDescription('Number of duplicate messages to trigger action')
            .setMinValue(2)
            .setMaxValue(10)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('emoji-limit')
        .setDescription('Set maximum emoji limit per message')
        .addIntegerOption(opt =>
          opt
            .setName('max')
            .setDescription('Max emojis allowed (0 to disable)')
            .setMinValue(0)
            .setMaxValue(50)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('caps-limit')
        .setDescription('Set maximum capitalization percentage')
        .addIntegerOption(opt =>
          opt
            .setName('percent')
            .setDescription('Max percentage of caps (0 to disable)')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('mention-limit')
        .setDescription('Set maximum mentions per message')
        .addIntegerOption(opt =>
          opt
            .setName('max')
            .setDescription('Max mentions allowed (0 to disable)')
            .setMinValue(0)
            .setMaxValue(20)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let updatedConfig: AutomodConfig = { ...config };
      let message = '';

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        updatedConfig.antispam = { ...config.antispam, enabled };
        message = `Anti-spam ${enabled ? '**enabled**' : '**disabled**'}`;
      } else if (subcommand === 'rate') {
        const messages = interaction.options.getInteger('messages', true);
        const seconds = interaction.options.getInteger('seconds', true);
        updatedConfig.antispam = {
          ...config.antispam,
          maxMessages: messages,
          timeframeSeconds: seconds
        };
        message = `Message rate set to **${messages}** messages per **${seconds}** seconds`;
      } else if (subcommand === 'duplicates') {
        const threshold = interaction.options.getInteger('threshold', true);
        updatedConfig.antispam = {
          ...config.antispam,
          duplicateThreshold: threshold
        };
        message = `Duplicate threshold set to **${threshold}** messages`;
      } else if (subcommand === 'emoji-limit') {
        const max = interaction.options.getInteger('max', true);
        updatedConfig.antispam = {
          ...config.antispam,
          maxEmojis: max
        };
        message = max === 0
          ? 'Emoji limit **disabled**'
          : `Emoji limit set to **${max}** emojis per message`;
      } else if (subcommand === 'caps-limit') {
        const percent = interaction.options.getInteger('percent', true);
        updatedConfig.antispam = {
          ...config.antispam,
          maxCaps: percent
        };
        message = percent === 0
          ? 'Caps limit **disabled**'
          : `Caps limit set to **${percent}%** of message`;
      } else if (subcommand === 'mention-limit') {
        const max = interaction.options.getInteger('max', true);
        updatedConfig.antispam = {
          ...config.antispam,
          maxMentions: max
        };
        message = max === 0
          ? 'Mention limit **disabled**'
          : `Mention limit set to **${max}** mentions per message`;
      }

      await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

      await interaction.editReply(successReply('Anti-Spam Updated', message));
    } catch (error) {
      await interaction.editReply(errorReply('Configuration Error', 'Failed to update anti-spam settings'));
      console.error('[Automod] Antispam command error:', error);
    }
  }
} as BotCommand;
