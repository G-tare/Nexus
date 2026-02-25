import { 
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  Colors,
  ChannelType,
  TextChannel,
  VoiceChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  name: 'musicconfig',
  module: 'music',
  permissionPath: 'music.musicconfig',
  data: new SlashCommandBuilder()
    .setName('musicconfig')
    .setDescription('Configure music module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('view').setDescription('View all music settings'))
    .addSubcommand((sub) =>
      sub
        .setName('default-volume')
        .setDescription('Set the default volume')
        .addIntegerOption((opt) =>
          opt
            .setName('volume')
            .setDescription('Volume 0-150')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(150)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-volume')
        .setDescription('Set the maximum allowed volume')
        .addIntegerOption((opt) =>
          opt
            .setName('volume')
            .setDescription('Volume 0-150')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(150)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-queue')
        .setDescription('Set maximum queue size (0 = unlimited)')
        .addIntegerOption((opt) =>
          opt
            .setName('size')
            .setDescription('Queue size 0-2000')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(2000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-duration')
        .setDescription('Set max song duration in seconds (0 = unlimited)')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Duration 0-36000 seconds')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(36000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('vote-skip')
        .setDescription('Configure vote skip settings')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable vote skip')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('percent')
            .setDescription('Percentage needed (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription('Configure now playing announcements')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable announcements')
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Announcement channel')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('restrict-channel')
        .setDescription('Restrict music commands to specific text channels')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Text channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove restriction')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('restrict-voice')
        .setDescription('Restrict bot to specific voice channels')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Voice channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove restriction')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('leave-behavior')
        .setDescription('Configure auto-leave behavior')
        .addBooleanOption((opt) =>
          opt
            .setName('on-empty')
            .setDescription('Leave when voice channel is empty')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('empty-delay')
            .setDescription('Delay before leaving (seconds)')
            .setMinValue(0)
            .setMaxValue(600)
        )
        .addBooleanOption((opt) =>
          opt.setName('on-finish').setDescription('Leave when queue finishes')
        )
        .addIntegerOption((opt) =>
          opt
            .setName('finish-delay')
            .setDescription('Delay before leaving (seconds)')
            .setMinValue(0)
            .setMaxValue(600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('twenty-four-seven')
        .setDescription('Configure 24/7 mode')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable/disable 24/7 mode')
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Voice channel to stay in')
            .addChannelTypes(ChannelType.GuildVoice)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('autoplay')
        .setDescription('Toggle autoplay globally')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable/disable autoplay')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('server-playlists')
        .setDescription('Toggle server playlists')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable/disable server playlists')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the **Manage Guild** permission to use this command.',
      });
      return;
    }

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      switch (subcommand) {
        case 'view': {
          const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('Music Configuration')
            .addFields(
              { name: 'Default Volume', value: `${config.defaultVolume ?? 100}%`, inline: true },
              { name: 'Max Volume', value: `${config.maxVolume ?? 150}%`, inline: true },
              { name: 'Max Queue Size', value: config.maxQueueSize === 0 ? 'Unlimited' : String(config.maxQueueSize ?? 500), inline: true },
              { name: 'Max Song Duration', value: config.maxDuration === 0 ? 'Unlimited' : `${config.maxDuration ?? 3600}s`, inline: true },
              { name: 'Vote Skip Enabled', value: config.voteSkipEnabled ? 'Yes' : 'No', inline: true },
              { name: 'Vote Skip Percent', value: `${config.voteSkipPercent ?? 50}%`, inline: true },
              { name: 'Now Playing Announce', value: config.announceNowPlaying ? 'Yes' : 'No', inline: true },
              { name: 'Autoplay Enabled', value: config.autoplayEnabled ? 'Yes' : 'No', inline: true },
              { name: 'Server Playlists', value: config.serverPlaylistsEnabled ? 'Yes' : 'No', inline: true },
              { name: 'Leave on Empty', value: config.leaveOnEmpty ? 'Yes' : 'No', inline: true },
              { name: 'Leave on Finish', value: config.leaveOnFinish ? 'Yes' : 'No', inline: true },
              { name: '24/7 Mode', value: config.twentyFourSeven ? 'Yes' : 'No', inline: true }
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'default-volume': {
          const volume = interaction.options.getInteger('volume', true);
          config.defaultVolume = volume;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Default Volume Set')
            .setDescription(`Default volume set to **${volume}%**.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'max-volume': {
          const volume = interaction.options.getInteger('volume', true);
          config.maxVolume = volume;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Max Volume Set')
            .setDescription(`Maximum volume set to **${volume}%**.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'max-queue': {
          const size = interaction.options.getInteger('size', true);
          config.maxQueueSize = size;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Max Queue Size Set')
            .setDescription(
              `Maximum queue size set to **${size === 0 ? 'unlimited' : size}**.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'max-duration': {
          const seconds = interaction.options.getInteger('seconds', true);
          config.maxDuration = seconds;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Max Duration Set')
            .setDescription(
              `Maximum song duration set to **${seconds === 0 ? 'unlimited' : `${seconds}s`}**.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'vote-skip': {
          const enabled = interaction.options.getBoolean('enabled');
          const percent = interaction.options.getInteger('percent');

          if (enabled !== null) config.voteSkipEnabled = enabled;
          if (percent !== null) config.voteSkipPercent = percent;

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Vote Skip Updated')
            .setDescription(
              `Vote skip: **${config.voteSkipEnabled ? 'enabled' : 'disabled'}** (${config.voteSkipPercent}%)`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'announce': {
          const enabled = interaction.options.getBoolean('enabled');
          const channel = interaction.options.getChannel('channel');

          if (enabled !== null) config.announceNowPlaying = enabled;
          if (channel) config.announcementChannelId = channel.id;

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Announcements Updated')
            .setDescription(
              `Now playing announcements: **${config.announceNowPlaying ? 'enabled' : 'disabled'}**${channel ? ` (${channel})` : ''}`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'restrict-channel': {
          const channel = interaction.options.getChannel('channel', true);
          const action = interaction.options.getString('action', true);

          if (!config.restrictedTextChannels) config.restrictedTextChannels = [];

          if (action === 'add') {
            if (!config.restrictedTextChannels.includes(channel.id)) {
              config.restrictedTextChannels.push(channel.id);
            }
          } else {
            config.restrictedTextChannels = config.restrictedTextChannels.filter(
              (id: any) => id !== channel.id
            );
          }

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Channel Restriction Updated')
            .setDescription(
              `${channel} has been **${action === 'add' ? 'added to' : 'removed from'}** music command restrictions.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'restrict-voice': {
          const channel = interaction.options.getChannel('channel', true);
          const action = interaction.options.getString('action', true);

          if (!config.restrictedVoiceChannels) config.restrictedVoiceChannels = [];

          if (action === 'add') {
            if (!config.restrictedVoiceChannels.includes(channel.id)) {
              config.restrictedVoiceChannels.push(channel.id);
            }
          } else {
            config.restrictedVoiceChannels = config.restrictedVoiceChannels.filter(
              (id: any) => id !== channel.id
            );
          }

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Voice Channel Restriction Updated')
            .setDescription(
              `${channel} has been **${action === 'add' ? 'added to' : 'removed from'}** bot access restrictions.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'leave-behavior': {
          const onEmpty = interaction.options.getBoolean('on-empty');
          const emptyDelay = interaction.options.getInteger('empty-delay');
          const onFinish = interaction.options.getBoolean('on-finish');
          const finishDelay = interaction.options.getInteger('finish-delay');

          if (onEmpty !== null) config.leaveOnEmpty = onEmpty;
          if (emptyDelay !== null) config.leaveOnEmptyDelay = emptyDelay;
          if (onFinish !== null) config.leaveOnFinish = onFinish;
          if (finishDelay !== null) config.leaveOnFinishDelay = finishDelay;

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Leave Behavior Updated')
            .addFields(
              {
                name: 'On Empty',
                value: `${config.leaveOnEmpty ? 'Yes' : 'No'} (${config.leaveOnEmptyDelay ?? 0}s)`,
                inline: true,
              },
              {
                name: 'On Finish',
                value: `${config.leaveOnFinish ? 'Yes' : 'No'} (${config.leaveOnFinishDelay ?? 0}s)`,
                inline: true,
              }
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'twenty-four-seven': {
          const enabled = interaction.options.getBoolean('enabled');
          const channel = interaction.options.getChannel('channel');

          if (enabled !== null) config.twentyFourSeven = enabled;
          if (channel) config.twentyFourSevenChannelId = channel.id;

          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('24/7 Mode Updated')
            .setDescription(
              `24/7 mode: **${config.twentyFourSeven ? 'enabled' : 'disabled'}**${channel ? ` (${channel})` : ''}`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'autoplay': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.autoplayEnabled = enabled;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Autoplay Updated')
            .setDescription(`Autoplay is now **${enabled ? 'enabled' : 'disabled'}**.`);

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case 'server-playlists': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.serverPlaylistsEnabled = enabled;
          moduleConfig.setConfig(guildId, 'music', config);

          const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('Server Playlists Updated')
            .setDescription(
              `Server playlists are now **${enabled ? 'enabled' : 'disabled'}**.`
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      console.error('Error in musicconfig command:', error);
      await interaction.reply({
        content: 'An error occurred while updating music configuration.',
      });
    }
  },
};

export default command;
