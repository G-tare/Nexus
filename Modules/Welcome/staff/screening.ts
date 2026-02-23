import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Welcome:Screening');

const screening: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.screening',
  premiumFeature: 'welcome.advanced',
  data: new SlashCommandBuilder()
    .setName('screening')
    .setDescription('Configure member screening and verification')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable member screening')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable screening')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Set the verified member role')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to assign to verified members')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('Set verification instructions')
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Instructions for member verification')
            .setMaxLength(2000)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

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
          screening: {
            ...currentConfig.screening,
            enabled,
          },
        });

        return interaction.editReply(
          `✅ Member screening has been **${enabled ? 'enabled' : 'disabled'}**.`
        );
      }

      if (subcommand === 'role') {
        const role = interaction.options.getRole('role', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          screening: {
            ...currentConfig.screening,
            verifiedRoleId: role.id,
          },
        });

        return interaction.editReply(
          `✅ Verified member role set to ${role}.`
        );
      }

      if (subcommand === 'message') {
        const message = interaction.options.getString('message', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          screening: {
            ...currentConfig.screening,
            message,
          },
        });

        return interaction.editReply(
          `✅ Verification instructions updated.\n\n**Preview:**\n${message}`
        );
      }
    } catch (error) {
      logger.error('Error in screening command:', error);
      return interaction.editReply(
        '❌ An error occurred while updating screening settings.'
      );
    }
  },
};

export default screening;
