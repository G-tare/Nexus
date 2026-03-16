import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

type AutomodFeature = 'antispam' | 'antiraid' | 'antilink' | 'antiinvite' | 'wordfilter' | 'antinuke';

const featureDisplayNames: Record<AutomodFeature, string> = {
  antispam: 'Antispam',
  antiraid: 'Antiraid',
  antilink: 'Antilink',
  antiinvite: 'Antiinvite',
  wordfilter: 'Word Filter',
  antinuke: 'Antinuke',
};

const command: BotCommand = {
  module: 'automod',
  permissionPath: 'automod.staff.toggle',
  allowDM: false,
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('automod-toggle')
    .setDescription('Enable or disable individual automod features')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('feature')
        .setDescription('The automod feature to toggle')
        .addChoices(
          { name: 'Antispam', value: 'antispam' },
          { name: 'Antiraid', value: 'antiraid' },
          { name: 'Antilink', value: 'antilink' },
          { name: 'Antiinvite', value: 'antiinvite' },
          { name: 'Word Filter', value: 'wordfilter' },
          { name: 'Antinuke', value: 'antinuke' }
        )
        .setRequired(true)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('enabled')
        .setDescription('Whether to enable or disable the feature')
        .setRequired(true)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);

      const feature = interaction.options.getString('feature', true) as AutomodFeature;
      const enabled = interaction.options.getBoolean('enabled', true);

      // Validate feature exists in config
      if (!(feature in config)) {
        await interaction.editReply(errorReply('Invalid Feature', 'The specified automod feature does not exist.'));
        return;
      }

      // Get the feature config
      const featureConfig = config[feature as keyof AutomodConfig];

      // Check if it's an object with an 'enabled' property
      if (
        typeof featureConfig !== 'object' ||
        featureConfig === null ||
        !('enabled' in featureConfig)
      ) {
        await interaction.editReply(errorReply('Invalid Feature', 'The specified automod feature cannot be toggled.'));
        return;
      }

      // Update the config
      (config[feature as keyof AutomodConfig] as any).enabled = enabled;

      // Save the config
      await moduleConfig.setConfig(guildId, 'automod', config);

      // Create response
      const displayName = featureDisplayNames[feature];
      await interaction.editReply(successReply(
        `${displayName} ${enabled ? 'Enabled' : 'Disabled'}`,
        `${displayName} is now **${enabled ? 'enabled' : 'disabled'}**.`
      ));
    } catch (error) {
      console.error('Error in automod-toggle command:', error);
      await interaction.editReply(errorReply('Command Error', 'An error occurred while processing your request.'));
    }
  },
};

export default command;
