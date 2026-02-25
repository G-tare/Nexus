import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getCountingConfig,
  saveCountingConfig,
  setCurrentCount,
} from '../helpers';

const command = new SlashCommandBuilder()
  .setName('counting-config')
  .setDescription('Configure the counting module')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View all counting configuration settings')
  )
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Set the counting channel')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('The channel for counting')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('math-mode')
      .setDescription('Toggle math expression support (e.g., 2+3)')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable math mode')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('double-count')
      .setDescription('Toggle allowing the same user to count twice in a row')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable double counting')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete-wrong')
      .setDescription('Toggle deleting wrong count messages')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable deletion of wrong counts')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset-on-wrong')
      .setDescription('Toggle resetting count to 0 on wrong number (if no lives)')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable reset on wrong count')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('react')
      .setDescription('Toggle checkmark reaction on correct counts')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable checkmark reactions')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('milestones')
      .setDescription('Configure milestone announcements')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable milestone announcements')
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('interval')
          .setDescription('Announce every X numbers (e.g., 100 for every 100)')
          .setRequired(false)
          .setMinValue(10)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('lives')
      .setDescription('Toggle the lives system')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable the lives system')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset-count')
      .setDescription('Reset the current count to 0')
  )
  .addSubcommand((sub) =>
    sub
      .setName('set-count')
      .setDescription('Set the count to a specific number')
      .addIntegerOption((opt) =>
        opt
          .setName('number')
          .setDescription('The number to set the count to')
          .setRequired(true)
          .setMinValue(0)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('global-leaderboard')
      .setDescription('Opt in/out of the global leaderboard')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Enable or disable global leaderboard')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('enable')
      .setDescription('Enable the counting module')
  )
  .addSubcommand((sub) =>
    sub
      .setName('disable')
      .setDescription('Disable the counting module')
  );

const configCommand: BotCommand = {
  data: command,
  module: 'counting',
  permissionPath: 'counting.counting-config',
  premium: false,
  category: 'staff',
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    try {
      const config = await getCountingConfig(guildId);

      if (subcommand === 'view') {
        const channel = config.channelId
          ? `<#${config.channelId}>`
          : 'Not set';

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('⚙️ Counting Configuration')
          .addFields(
            { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Channel', value: channel, inline: true },
            { name: 'Current Count', value: String(config.currentCount), inline: true },
            { name: 'Math Mode', value: config.mathMode ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Allow Double Count', value: config.allowDoubleCount ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Delete Wrong Numbers', value: config.deleteWrongNumbers ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Reset on Wrong', value: config.resetOnWrong ? '✅ Yes' : '❌ No', inline: true },
            { name: 'React on Correct', value: config.reactOnCorrect ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Milestones Enabled', value: config.notifyOnMilestone ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Milestone Interval', value: `Every ${config.milestoneInterval} numbers`, inline: true },
            { name: 'Lives System', value: config.livesEnabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Global Leaderboard', value: config.globalLeaderboardEnabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Server Record', value: String(config.highestCount), inline: true },
            { name: 'Total Counts', value: String(config.totalCounts), inline: true },
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        config.channelId = channel.id;
        config.enabled = true;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Counting Channel Set')
          .setDescription(`Counting channel set to ${channel.toString()}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'math-mode') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.mathMode = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Math Mode Updated')
          .setDescription(`Math mode is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'double-count') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.allowDoubleCount = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Double Count Updated')
          .setDescription(`Double counting is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'delete-wrong') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.deleteWrongNumbers = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Delete Wrong Updated')
          .setDescription(`Deleting wrong numbers is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'reset-on-wrong') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.resetOnWrong = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Reset on Wrong Updated')
          .setDescription(`Resetting on wrong count is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'react') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.reactOnCorrect = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Reaction Updated')
          .setDescription(`Checkmark reactions are now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'milestones') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const interval = interaction.options.getInteger('interval');

        config.notifyOnMilestone = enabled;
        if (interval !== null && interval > 0) {
          config.milestoneInterval = interval;
        }

        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Milestones Updated')
          .setDescription(
            `Milestone announcements are now ${enabled ? '**enabled**' : '**disabled**'}` +
            (interval ? `\nInterval set to **${interval}**` : '')
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'lives') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.livesEnabled = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Lives System Updated')
          .setDescription(`Lives system is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'reset-count') {
        await setCurrentCount(guildId, 0);
        config.currentCount = 0;
        config.lastCounterId = null;
        config.currentStreak = 0;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Count Reset')
          .setDescription('The count has been reset to **0**')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'set-count') {
        const number = interaction.options.getInteger('number', true);
        await setCurrentCount(guildId, number);
        config.currentCount = number;
        config.lastCounterId = null;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Count Updated')
          .setDescription(`The count has been set to **${number}**`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'global-leaderboard') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.globalLeaderboardEnabled = enabled;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Global Leaderboard Updated')
          .setDescription(`Global leaderboard is now ${enabled ? '**enabled**' : '**disabled**'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'enable') {
        if (!config.channelId) {
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription('Please set a counting channel first using `/counting-config channel`')
            .setTimestamp();

          return interaction.reply({ embeds: [embed] });
        }

        config.enabled = true;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle('✅ Counting Enabled')
          .setDescription(`Counting is now active in ${config.channelId ? `<#${config.channelId}>` : 'an unknown channel'}`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'disable') {
        config.enabled = false;
        await saveCountingConfig(guildId, config);

        const embed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('⚠️ Counting Disabled')
          .setDescription('Counting has been disabled on this server')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[Counting] Error in /counting-config:', error);
      return interaction.reply({
        content: 'An error occurred while updating the configuration.',
      });
    }
  },
};

export default configCommand;
