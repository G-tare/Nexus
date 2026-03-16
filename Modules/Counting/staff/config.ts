import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { cache } from '../../../Shared/src/cache/cacheManager';
import {
  getCountingConfig,
  saveCountingConfig,
  setCurrentCount,
} from '../helpers';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  warningContainer,
  addFields,
  addText,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

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
      .setName('strict-mode')
      .setDescription('Toggle strict mode — when OFF, users can chat freely alongside counting')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('ON = numbers only, OFF = talking allowed (default OFF)')
          .setRequired(true)
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
      .setName('unban-counter')
      .setDescription('Remove a counting ban from a user (resets their delete strikes)')
      .addUserOption((opt) =>
        opt
          .setName('user')
          .setDescription('The user to unban from counting')
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

        const container = moduleContainer('counting');
        addText(container, '### ⚙️ Counting Configuration');
        addFields(container, [
          { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Channel', value: channel, inline: true },
          { name: 'Current Count', value: String(config.currentCount), inline: true },
          { name: 'Strict Mode', value: config.strictMode ? '✅ Numbers Only' : '❌ Talking Allowed', inline: true },
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
        ]);

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        config.channelId = channel.id;
        config.enabled = true;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Counting Channel Set',
          `Counting channel set to ${channel.toString()}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'strict-mode') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.strictMode = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Strict Mode Updated',
          enabled
            ? 'Strict mode is now **enabled** — only numbers are allowed in the counting channel. Any other text will break the streak.'
            : 'Strict mode is now **disabled** — users can chat freely in the counting channel. Only messages that are numbers (or math expressions) will be counted.'
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'math-mode') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.mathMode = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Math Mode Updated',
          `Math mode is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'double-count') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.allowDoubleCount = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Double Count Updated',
          `Double counting is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'delete-wrong') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.deleteWrongNumbers = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Delete Wrong Updated',
          `Deleting wrong numbers is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'reset-on-wrong') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.resetOnWrong = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Reset on Wrong Updated',
          `Resetting on wrong count is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'react') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.reactOnCorrect = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Reaction Updated',
          `Checkmark reactions are now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'milestones') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const interval = interaction.options.getInteger('interval');

        config.notifyOnMilestone = enabled;
        if (interval !== null && interval > 0) {
          config.milestoneInterval = interval;
        }

        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Milestones Updated',
          `Milestone announcements are now ${enabled ? '**enabled**' : '**disabled**'}` +
          (interval ? `\nInterval set to **${interval}**` : '')
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'lives') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.livesEnabled = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Lives System Updated',
          `Lives system is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'reset-count') {
        await setCurrentCount(guildId, 0);
        config.currentCount = 0;
        config.lastCounterId = null;
        config.currentStreak = 0;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Count Reset',
          'The count has been reset to **0**'
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'set-count') {
        const number = interaction.options.getInteger('number', true);
        await setCurrentCount(guildId, number);
        config.currentCount = number;
        config.lastCounterId = null;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Count Updated',
          `The count has been set to **${number}**`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'global-leaderboard') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.globalLeaderboardEnabled = enabled;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Global Leaderboard Updated',
          `Global leaderboard is now ${enabled ? '**enabled**' : '**disabled**'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'unban-counter') {
        const user = interaction.options.getUser('user', true);
        const redis = (await import('../../../Shared/src/cache/cacheManager')).cache;

        // Remove ban and reset strikes
        cache.del(`counting:ban:${guildId}:${user.id}`);
        cache.del(`counting:strikes:${guildId}:${user.id}`);

        const container = successContainer(
          '✅ Counting Ban Removed',
          `${user.tag} has been unbanned from counting and their strike count has been reset.`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'enable') {
        if (!config.channelId) {
          const container = errorContainer(
            '❌ Error',
            'Please set a counting channel first using `/counting-config channel`'
          );

          return interaction.reply(v2Payload([container]));
        }

        config.enabled = true;
        await saveCountingConfig(guildId, config);

        const container = successContainer(
          '✅ Counting Enabled',
          `Counting is now active in ${config.channelId ? `<#${config.channelId}>` : 'an unknown channel'}`
        );

        return interaction.reply(v2Payload([container]));
      }

      if (subcommand === 'disable') {
        config.enabled = false;
        await saveCountingConfig(guildId, config);

        const container = warningContainer(
          '⚠️ Counting Disabled',
          'Counting has been disabled on this server'
        );

        return interaction.reply(v2Payload([container]));
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
