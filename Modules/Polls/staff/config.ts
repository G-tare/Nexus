import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getPollConfig,
  setPollConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('poll-config')
    .setDescription('Configure default poll settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current poll configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('anonymous')
        .setDescription('Set default anonymous voting')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable anonymous voting by default')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('live-results')
        .setDescription('Set default live results visibility')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Show live results by default')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-votes')
        .setDescription('Set default max votes per user')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('0 = unlimited, 1+ = max selections (default: 1)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-options')
        .setDescription('Set max options per poll')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Maximum options per poll (default: 10)')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(10)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-duration')
        .setDescription('Set max poll duration in hours')
        .addIntegerOption((option) =>
          option
            .setName('hours')
            .setDescription('Maximum poll duration in hours (default: 168)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction, deps: any) => {
    const { redis, client } = deps;

    const subcommand = interaction.options.getSubcommand();

    try {
      const currentConfig = await getPollConfig(interaction.guildId!, redis);

      if (subcommand === 'view') {
        const lines = [
          '**Poll Configuration**',
          `Anonymous voting: ${currentConfig.defaultAnonymous ? '✅ Enabled' : '❌ Disabled'}`,
          `Live results: ${currentConfig.defaultShowLiveResults ? '✅ Enabled' : '❌ Disabled'}`,
          `Default max votes: ${currentConfig.defaultMaxVotes === 0 ? 'Unlimited' : currentConfig.defaultMaxVotes}`,
          `Max options per poll: ${currentConfig.maxOptions}`,
          `Max poll duration: ${currentConfig.maxDuration} hours`,
        ];

        return await interaction.reply({
          content: lines.join('\n'),
        });
      }

      if (subcommand === 'anonymous') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setPollConfig(interaction.guildId!, { defaultAnonymous: enabled }, redis);

        return await interaction.reply({
          content: `✅ Default anonymous voting is now ${enabled ? '**enabled**' : '**disabled**'}.`,
        });
      }

      if (subcommand === 'live-results') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setPollConfig(interaction.guildId!, { defaultShowLiveResults: enabled }, redis);

        return await interaction.reply({
          content: `✅ Default live results visibility is now ${enabled ? '**enabled**' : '**disabled**'}.`,
        });
      }

      if (subcommand === 'max-votes') {
        const count = interaction.options.getInteger('count', true);
        await setPollConfig(interaction.guildId!, { defaultMaxVotes: count }, redis);

        const text = count === 0 ? 'unlimited' : `${count}`;
        return await interaction.reply({
          content: `✅ Default max votes per user is now set to **${text}**.`,
        });
      }

      if (subcommand === 'max-options') {
        const count = interaction.options.getInteger('count', true);
        await setPollConfig(interaction.guildId!, { maxOptions: count }, redis);

        return await interaction.reply({
          content: `✅ Max options per poll is now set to **${count}**.`,
        });
      }

      if (subcommand === 'max-duration') {
        const hours = interaction.options.getInteger('hours', true);
        await setPollConfig(interaction.guildId!, { maxDuration: hours }, redis);

        return await interaction.reply({
          content: `✅ Max poll duration is now set to **${hours}** hours.`,
        });
      }
    } catch (error) {
      console.error('Error in /poll-config command:', error);
      await interaction.reply({
        content: '❌ An error occurred while updating poll configuration.',
      });
    }
  },

  module: 'polls',
  permissionPath: 'polls.poll-config',
  premiumFeature: 'polls.basic',
};

export default command;
