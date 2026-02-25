import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Welcome:JoinGate');

const joingate: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.joingate',
  premiumFeature: 'welcome.advanced',
  data: new SlashCommandBuilder()
    .setName('joingate')
    .setDescription('Configure account age verification and join gate')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the join gate')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable join gate')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('min-age')
        .setDescription('Set minimum account age required')
        .addIntegerOption((opt) =>
          opt
            .setName('days')
            .setDescription('Minimum account age in days (1-365)')
            .setMinValue(1)
            .setMaxValue(365)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('action')
        .setDescription('Set action for accounts younger than minimum age')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take for young accounts')
            .addChoices(
              { name: 'Kick', value: 'kick' },
              { name: 'Quarantine', value: 'quarantine' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('verify-channel')
        .setDescription('Set verification channel for quarantined members')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel where quarantined members can verify')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-kicks')
        .setDescription('Toggle logging of account age-based kicks')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable kick logging')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    try {
      const _curCfgResult = await moduleConfig.getModuleConfig(guildId, 'welcome');
      const _curCfg = (_curCfgResult?.config ?? {}) as Record<string, any>;
      const currentConfig = (_curCfg?.config ?? {}) as any;

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          joingate: {
            ...currentConfig.joingate,
            enabled,
          },
        });

        return interaction.editReply(
          `✅ Join gate has been **${enabled ? 'enabled' : 'disabled'}**.`
        );
      }

      if (subcommand === 'min-age') {
        const days = interaction.options.getInteger('days', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          joingate: {
            ...currentConfig.joingate,
            minimumAccountAgeDays: days,
          },
        });

        return interaction.editReply(
          `✅ Minimum account age set to **${days} day${days !== 1 ? 's' : ''}**.`
        );
      }

      if (subcommand === 'action') {
        const action = interaction.options.getString('action', true) as 'kick' | 'quarantine';

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          joingate: {
            ...currentConfig.joingate,
            actionForYoungAccounts: action,
          },
        });

        return interaction.editReply(
          `✅ Action for young accounts set to **${action.charAt(0).toUpperCase() + action.slice(1)}**.`
        );
      }

      if (subcommand === 'verify-channel') {
        const channel = interaction.options.getChannel('channel', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          joingate: {
            ...currentConfig.joingate,
            verificationChannelId: channel.id,
          },
        });

        return interaction.editReply(
          `✅ Verification channel set to ${channel}.`
        );
      }

      if (subcommand === 'log-kicks') {
        const enabled = interaction.options.getBoolean('enabled', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          joingate: {
            ...currentConfig.joingate,
            logKicks: enabled,
          },
        });

        return interaction.editReply(
          `✅ Kick logging has been **${enabled ? 'enabled' : 'disabled'}**.`
        );
      }
    } catch (error) {
      logger.error('Error in joingate command:', error);
      return interaction.editReply(
        '❌ An error occurred while updating join gate settings.'
      );
    }
  },
};

export default joingate;
