import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  module: 'automod',
  permissionPath: 'automod.staff.antiraid',
  premiumFeature: 'automod.advanced',
  permissions: [PermissionFlagsBits.ManageGuild],

  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid detection settings')
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable anti-raid detection')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable anti-raid')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('threshold')
        .setDescription('Set the join rate threshold for raid detection')
        .addIntegerOption(opt =>
          opt
            .setName('joins')
            .setDescription('Number of joins to trigger raid detection')
            .setMinValue(3)
            .setMaxValue(50)
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('seconds')
            .setDescription('Time window in seconds')
            .setMinValue(5)
            .setMaxValue(60)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('account-age')
        .setDescription('Set minimum account age requirement')
        .addIntegerOption(opt =>
          opt
            .setName('days')
            .setDescription('Minimum account age in days (0 to disable)')
            .setMinValue(0)
            .setMaxValue(365)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('action')
        .setDescription('Set the action to take on suspected raids')
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Action to perform')
            .addChoices(
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
              { name: 'Lockdown', value: 'lockdown' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('lockdown-duration')
        .setDescription('Set lockdown duration for raid action')
        .addIntegerOption(opt =>
          opt
            .setName('minutes')
            .setDescription('Duration in minutes')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let updatedConfig: AutomodConfig = { ...config };
      let message = '';

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        updatedConfig.antiraid = { ...config.antiraid, enabled };
        message = `Anti-raid ${enabled ? '**enabled**' : '**disabled**'}`;
      } else if (subcommand === 'threshold') {
        const joins = interaction.options.getInteger('joins', true);
        const seconds = interaction.options.getInteger('seconds', true);
        updatedConfig.antiraid = {
          ...config.antiraid,
          joinThreshold: joins,
          timeframeSeconds: seconds
        };
        message = `Raid threshold set to **${joins}** joins in **${seconds}** seconds`;
      } else if (subcommand === 'account-age') {
        const days = interaction.options.getInteger('days', true);
        updatedConfig.antiraid = {
          ...config.antiraid,
          minAccountAgeDays: days
        };
        message = days === 0
          ? 'Account age requirement **disabled**'
          : `Minimum account age set to **${days}** days`;
      } else if (subcommand === 'action') {
        const action = interaction.options.getString('action', true) as 'kick' | 'ban' | 'lockdown';
        updatedConfig.antiraid = {
          ...config.antiraid,
          action
        };
        message = `Raid action set to **${action}**`;
      } else if (subcommand === 'lockdown-duration') {
        const minutes = interaction.options.getInteger('minutes', true);
        updatedConfig.antiraid = {
          ...config.antiraid,
          lockdownDurationMinutes: minutes
        };
        message = `Lockdown duration set to **${minutes}** minutes`;
      }

      await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

      const embed = successEmbed(`Anti-Raid Updated\n${message}`);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = errorEmbed('Failed to update anti-raid settings');
      await interaction.editReply({ embeds: [embed] });
      console.error('[Automod] Antiraid command error:', error);
    }
  }
} as BotCommand;
