import {  SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addFields, successReply, infoReply, v2Payload } from '../../../Shared/src/utils/componentsV2';

interface FunConfig {
  gambling: boolean;
  minBet: number;
  maxBet: number;
  globalCooldown: number;
  disabledCommands: string[];
  interactionsEnabled: boolean;
  gamesEnabled: boolean;
  gifsEnabled: boolean;
}

// TODO: Implement database integration for config persistence
const defaultConfig: FunConfig = {
  gambling: false,
  minBet: 10,
  maxBet: 1000,
  globalCooldown: 0,
  disabledCommands: [],
  interactionsEnabled: true,
  gamesEnabled: true,
  gifsEnabled: true
};

export default {
  module: 'fun',
  data: new SlashCommandBuilder()
    .setName('fun-config')
    .setDescription('Configure fun module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View all fun settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('gambling')
        .setDescription('Toggle gambling commands')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable gambling')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bet-limits')
        .setDescription('Set minimum and maximum bet amounts')
        .addIntegerOption(option =>
          option.setName('min')
            .setDescription('Minimum bet amount')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(option =>
          option.setName('max')
            .setDescription('Maximum bet amount')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cooldown')
        .setDescription('Set global cooldown for fun commands')
        .addIntegerOption(option =>
          option.setName('seconds')
            .setDescription('Cooldown in seconds (0-60)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(60)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable-command')
        .setDescription('Disable a specific fun command')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to disable')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable-command')
        .setDescription('Re-enable a fun command')
        .addStringOption(option =>
          option.setName('command')
            .setDescription('Command name to enable')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('interactions')
        .setDescription('Toggle interaction commands (hug, pat, etc.)')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable interaction commands')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('games')
        .setDescription('Toggle game commands')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable game commands')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('gifs')
        .setDescription('Toggle GIF animations for interactions')
        .addBooleanOption(option =>
          option.setName('enabled')
            .setDescription('Enable or disable GIFs in interactions')
            .setRequired(true)
        )
    ),
  permissionPath: 'fun.staff.config',
  category: 'fun',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Fetch actual config from database based on guild ID
      const config: FunConfig = { ...defaultConfig };

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'view') {
        const container = infoReply('Fun Module Configuration');
        const containerObj = container.components[0];
        addFields(containerObj, [
          { name: 'Gambling Enabled', value: config.gambling ? 'Yes' : 'No', inline: true },
          { name: 'Min Bet', value: `${config.minBet}`, inline: true },
          { name: 'Max Bet', value: `${config.maxBet}`, inline: true },
          { name: 'Global Cooldown', value: `${config.globalCooldown}s`, inline: true },
          { name: 'Interactions Enabled', value: config.interactionsEnabled ? 'Yes' : 'No', inline: true },
          { name: 'Games Enabled', value: config.gamesEnabled ? 'Yes' : 'No', inline: true },
          { name: 'GIFs Enabled', value: config.gifsEnabled ? 'Yes' : 'No', inline: true },
          { name: 'Disabled Commands', value: config.disabledCommands.length > 0 ? config.disabledCommands.join(', ') : 'None', inline: false }
        ]);

        await interaction.reply(container);
      } else if (subcommand === 'gambling') {
        const enabled = interaction.options.getBoolean('enabled', true);
        // TODO: Update config in database
        config.gambling = enabled;

        await interaction.reply({
          content: `Gambling commands have been ${enabled ? 'enabled' : 'disabled'}.`
        });
      } else if (subcommand === 'bet-limits') {
        const min = interaction.options.getInteger('min', true);
        const max = interaction.options.getInteger('max', true);

        if (min > max) {
          await interaction.reply({
            content: 'Minimum bet cannot be greater than maximum bet.'
          });
          return;
        }

        // TODO: Update config in database
        config.minBet = min;
        config.maxBet = max;

        await interaction.reply({
          content: `Bet limits set: Min: ${min}, Max: ${max}`
        });
      } else if (subcommand === 'cooldown') {
        const seconds = interaction.options.getInteger('seconds', true);
        // TODO: Update config in database
        config.globalCooldown = seconds;

        await interaction.reply({
          content: `Global cooldown set to ${seconds} seconds.`
        });
      } else if (subcommand === 'disable-command') {
        const command = interaction.options.getString('command', true);

        if (!config.disabledCommands.includes(command)) {
          config.disabledCommands.push(command);
        }

        // TODO: Update config in database

        await interaction.reply({
          content: `Command \`${command}\` has been disabled.`
        });
      } else if (subcommand === 'enable-command') {
        const command = interaction.options.getString('command', true);

        config.disabledCommands = config.disabledCommands.filter(c => c !== command);

        // TODO: Update config in database

        await interaction.reply({
          content: `Command \`${command}\` has been enabled.`
        });
      } else if (subcommand === 'interactions') {
        const enabled = interaction.options.getBoolean('enabled', true);
        // TODO: Update config in database
        config.interactionsEnabled = enabled;

        await interaction.reply({
          content: `Interaction commands have been ${enabled ? 'enabled' : 'disabled'}.`
        });
      } else if (subcommand === 'games') {
        const enabled = interaction.options.getBoolean('enabled', true);
        // TODO: Update config in database
        config.gamesEnabled = enabled;

        await interaction.reply({
          content: `Game commands have been ${enabled ? 'enabled' : 'disabled'}.`
        });
      } else if (subcommand === 'gifs') {
        const enabled = interaction.options.getBoolean('enabled', true);
        // TODO: Update config in database
        config.gifsEnabled = enabled;

        await interaction.reply({
          content: `GIF animations have been ${enabled ? 'enabled' : 'disabled'}.`
        });
      }
    } catch (error) {
      console.error('Fun config command error:', error);
      await interaction.reply({
        content: 'Failed to update fun configuration. Please try again later.'
      });
    }
  }
} as BotCommand;
