import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import {
  getVoicePhoneConfig,
  getPendingAppeals,
  getAppeal,
  resolveAppeal,
  unbanUser,
  getGlobalStats,
  formatDuration,
  isUserBanned,
  getTempBanCount,
} from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('voicephoneconfig')
    .setDescription('View or update voice phone settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current voice phone settings'))
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Toggle a voice channel for voice phone')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to toggle')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Toggle a server ID in the blacklist')
        .addStringOption(opt =>
          opt.setName('server_id')
            .setDescription('Server ID to toggle')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('duration')
        .setDescription('Set max call duration in seconds')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Max duration (60-3600, 0 for unlimited)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(3600)))
    .addSubcommand(sub =>
      sub.setName('bitrate')
        .setDescription('Set audio bitrate for relay')
        .addIntegerOption(opt =>
          opt.setName('bitrate')
            .setDescription('Bitrate (32000-128000)')
            .setRequired(true)
            .setMinValue(32000)
            .setMaxValue(128000)))
    .addSubcommand(sub =>
      sub.setName('maxspeakers')
        .setDescription('Set max simultaneous speakers per side')
        .addIntegerOption(opt =>
          opt.setName('count')
            .setDescription('Max speakers (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('showserver')
        .setDescription('Toggle showing server name to the other side')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Show server name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reportchannel')
        .setDescription('Set the report channel for voice phone')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Report channel (leave empty to disable)')
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('cooldown')
        .setDescription('Set cooldown between calls')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Cooldown in seconds (10-600)')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(600)))
    .addSubcommand(sub =>
      sub.setName('minsize')
        .setDescription('Set minimum server member count to use voice phone')
        .addIntegerOption(opt =>
          opt.setName('count')
            .setDescription('Minimum members (0 to disable, default 50)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(10000)))
    .addSubcommand(sub =>
      sub.setName('requirecommunity')
        .setDescription('Require the server to be a Community server')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Require Community (default: true)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('maxstrikes')
        .setDescription('Set max strikes before auto-disconnect')
        .addIntegerOption(opt =>
          opt.setName('count')
            .setDescription('Max strikes per call (1-10, default 3)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('strikeban')
        .setDescription('Set temp ban duration after reaching max strikes')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Ban duration in seconds (300-86400, default 3600)')
            .setRequired(true)
            .setMinValue(300)
            .setMaxValue(86400)))
    .addSubcommand(sub =>
      sub.setName('appeals')
        .setDescription('View pending Voice Phone appeals'))
    .addSubcommand(sub =>
      sub.setName('appealresolve')
        .setDescription('Approve or deny a Voice Phone appeal')
        .addStringOption(opt =>
          opt.setName('appeal_id')
            .setDescription('The appeal ID to resolve')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Approve or deny')
            .setRequired(true)
            .addChoices(
              { name: 'Approve (unban user)', value: 'approved' },
              { name: 'Deny (keep ban)', value: 'denied' },
            ))
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for your decision')
            .setRequired(false)
            .setMaxLength(500)))
    .addSubcommand(sub =>
      sub.setName('unban')
        .setDescription('Unban a user from Voice Phone')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to unban')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View Voice Phone global statistics'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'voicephone',
  permissionPath: 'voicephone.voicephoneconfig',
  premiumFeature: 'voicephone.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const config = await getVoicePhoneConfig(guild.id);

      const container = moduleContainer('voicephone');
      addText(container, '### 📞 Voice Phone Settings');
      addFields(container, [
        {
          name: 'Allowed Channels',
          value: config.allowedChannels.length > 0
            ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
            : 'All voice channels',
        },
        {
          name: 'Blacklisted Servers',
          value: config.blacklistedServers.length > 0
            ? config.blacklistedServers.join(', ')
            : 'None',
        },
        { name: 'Max Duration', value: config.maxDuration > 0 ? `${config.maxDuration}s (${Math.floor(config.maxDuration / 60)}m)` : 'Unlimited', inline: true },
        { name: 'Cooldown', value: `${config.callCooldown}s`, inline: true },
        { name: 'Max Speakers/Side', value: `${config.maxSpeakersPerSide}`, inline: true },
        { name: 'Bitrate', value: `${config.bitrate / 1000}kbps`, inline: true },
        { name: 'Show Server Name', value: config.showServerName ? '✅' : '❌', inline: true },
        { name: 'Report Channel', value: config.reportChannelId ? `<#${config.reportChannelId}>` : 'Not set', inline: true },
        { name: 'Safety & Trust', value: `**Min Server Size:** ${config.minServerSize > 0 ? `${config.minServerSize} members` : 'Disabled'}\n**Require Community:** ${config.requireCommunity ? '✅' : '❌'}\n**Max Strikes:** ${config.maxStrikes}\n**Strike Ban:** ${config.strikeBanDuration}s (${Math.floor(config.strikeBanDuration / 60)}m)` },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      const config = await getVoicePhoneConfig(guild.id);
      const channels = [...config.allowedChannels];

      const index = channels.indexOf(channel.id);
      if (index >= 0) {
        channels.splice(index, 1);
        await moduleConfig.updateConfig(guild.id, 'voicephone', { allowedChannels: channels });
        await interaction.reply({ content: `✅ Removed <#${channel.id}> from voice phone channels.` });
      } else {
        channels.push(channel.id);
        await moduleConfig.updateConfig(guild.id, 'voicephone', { allowedChannels: channels });
        await interaction.reply({ content: `✅ Added <#${channel.id}> to voice phone channels.` });
      }
      return;
    }

    if (sub === 'blacklist') {
      const serverId = interaction.options.getString('server_id', true);
      const config = await getVoicePhoneConfig(guild.id);
      const blacklist = [...config.blacklistedServers];

      const index = blacklist.indexOf(serverId);
      if (index >= 0) {
        blacklist.splice(index, 1);
        await moduleConfig.updateConfig(guild.id, 'voicephone', { blacklistedServers: blacklist });
        await interaction.reply({ content: `✅ Removed \`${serverId}\` from the blacklist.` });
      } else {
        blacklist.push(serverId);
        await moduleConfig.updateConfig(guild.id, 'voicephone', { blacklistedServers: blacklist });
        await interaction.reply({ content: `✅ Added \`${serverId}\` to the blacklist.` });
      }
      return;
    }

    if (sub === 'duration') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { maxDuration: seconds });
      await interaction.reply({
        content: seconds > 0
          ? `✅ Max call duration set to **${seconds}s** (${Math.floor(seconds / 60)}m).`
          : '✅ Call duration set to **unlimited**.',
      });
      return;
    }

    if (sub === 'bitrate') {
      const bitrate = interaction.options.getInteger('bitrate', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { bitrate });
      await interaction.reply({ content: `✅ Audio bitrate set to **${bitrate / 1000}kbps**.` });
      return;
    }

    if (sub === 'maxspeakers') {
      const count = interaction.options.getInteger('count', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { maxSpeakersPerSide: count });
      await interaction.reply({ content: `✅ Max speakers per side set to **${count}**.` });
      return;
    }

    if (sub === 'showserver') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { showServerName: enabled });
      await interaction.reply({ content: `✅ Show server name ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'reportchannel') {
      const channel = interaction.options.getChannel('channel');
      await moduleConfig.updateConfig(guild.id, 'voicephone', { reportChannelId: channel?.id || null });
      await interaction.reply({
        content: channel
          ? `✅ Report channel set to <#${channel.id}>.`
          : '✅ Report channel disabled.',
      });
      return;
    }

    if (sub === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { callCooldown: seconds });
      await interaction.reply({ content: `✅ Call cooldown set to **${seconds}s**.` });
      return;
    }

    if (sub === 'minsize') {
      const count = interaction.options.getInteger('count', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { minServerSize: count });
      await interaction.reply({
        content: count > 0
          ? `✅ Minimum server size set to **${count} members**.`
          : '✅ Minimum server size requirement **disabled**.',
      });
      return;
    }

    if (sub === 'requirecommunity') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { requireCommunity: enabled });
      await interaction.reply({
        content: enabled
          ? '✅ Community server requirement **enabled**. Only Discord Community servers can use Voice Phone.'
          : '✅ Community server requirement **disabled**.',
      });
      return;
    }

    if (sub === 'maxstrikes') {
      const count = interaction.options.getInteger('count', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { maxStrikes: count });
      await interaction.reply({ content: `✅ Max strikes per call set to **${count}**.` });
      return;
    }

    if (sub === 'strikeban') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'voicephone', { strikeBanDuration: seconds });
      await interaction.reply({
        content: `✅ Strike temp-ban duration set to **${seconds}s** (${Math.floor(seconds / 60)}m).`,
      });
      return;
    }

    if (sub === 'appeals') {
      const appealIds = await getPendingAppeals();

      if (appealIds.length === 0) {
        await interaction.reply({ content: '✅ No pending Voice Phone appeals.' });
        return;
      }

      // Fetch details for each appeal (up to 10)
      const appeals = [];
      for (const id of appealIds.slice(0, 10)) {
        const appeal = await getAppeal(id);
        if (appeal) appeals.push(appeal);
      }

      const appealsList = appeals.map((a, i) => {
        const ageMs = Date.now() - a.createdAt;
        const ageHours = Math.floor(ageMs / 3_600_000);
        return [
          `**${i + 1}.** \`${a.appealId}\``,
          `   User: <@${a.userId}> | Ban: ${a.banType} | Clips: ${a.audioClipIds.length}`,
          `   Filed: ${ageHours}h ago`,
          `   Statement: *${a.userStatement.slice(0, 80)}${a.userStatement.length > 80 ? '...' : ''}*`,
        ].join('\n');
      }).join('\n\n') +
        (appealIds.length > 10 ? `\n\n*...and ${appealIds.length - 10} more*` : '');

      const container = moduleContainer('voicephone');
      addText(container, `### 📋 Pending Voice Phone Appeals\n${appealsList}`);
      addText(container, '-# Use /voicephoneconfig appealresolve <id> to approve/deny');

      await interaction.reply(v2Payload([container]));
      return;
    }

    if (sub === 'appealresolve') {
      const appealId = interaction.options.getString('appeal_id', true);
      const action = interaction.options.getString('action', true) as 'approved' | 'denied';
      const reason = interaction.options.getString('reason') ?? (action === 'approved' ? 'Appeal approved' : 'Appeal denied');

      const appeal = await resolveAppeal(appealId, action, reason);

      if (!appeal) {
        await interaction.reply({
          content: `❌ Appeal \`${appealId}\` not found or already resolved.`,
          flags: 64 as number, // Ephemeral
        });
        return;
      }

      const emoji = action === 'approved' ? '✅' : '❌';
      await interaction.reply({
        content: `${emoji} Appeal \`${appealId}\` has been **${action}**.\n` +
          `📋 Reason: ${reason}\n` +
          `👤 User: <@${appeal.userId}>\n` +
          (action === 'approved' ? '🔓 The user has been unbanned from Voice Phone.' : '🔒 The user\'s ban remains in effect.'),
      });

      // Try to DM the user about the resolution
      try {
        const user = await interaction.client.users.fetch(appeal.userId);
        const dmContainer = moduleContainer('voicephone');
        addText(dmContainer,
          `### ${action === 'approved' ? '✅ Appeal Approved' : '❌ Appeal Denied'}\n\n` +
          (action === 'approved'
            ? `Your Voice Phone appeal (\`${appealId}\`) has been **approved**. Your ban has been lifted — you can use Voice Phone again!`
            : `Your Voice Phone appeal (\`${appealId}\`) has been **denied**.\n\n📋 Reason: ${reason}`)
        );
        await user.send(v2Payload([dmContainer]));
      } catch {
        // DMs might be disabled
      }
      return;
    }

    if (sub === 'unban') {
      const user = interaction.options.getUser('user', true);

      // Check if user is actually banned
      const banStatus = await isUserBanned(user.id);
      if (!banStatus.banned) {
        await interaction.reply({
          content: `✅ <@${user.id}> is not currently banned from Voice Phone.`,
        });
        return;
      }

      await unbanUser(user.id);
      const banType = banStatus.permanent ? 'permanently' : 'temporarily';
      const banCount = await getTempBanCount(user.id);

      await interaction.reply({
        content: `🔓 <@${user.id}> has been unbanned from Voice Phone.\n` +
          `📋 Was ${banType} banned. Ban counter has been reset.`,
      });

      // DM the user
      try {
        const dmContainer = moduleContainer('voicephone');
        addText(dmContainer, '### 🔓 Voice Phone Ban Lifted\n\nA server admin has unbanned you from Voice Phone. You can use it again!');
        await user.send(v2Payload([dmContainer]));
      } catch {
        // DMs might be disabled
      }
      return;
    }

    if (sub === 'stats') {
      await interaction.deferReply();

      const stats = await getGlobalStats();

      const container = moduleContainer('voicephone');
      addFields(container, [
        { name: 'Total Calls', value: `**${stats.totalCalls.toLocaleString()}**`, inline: true },
        { name: 'Total Duration', value: `**${formatDuration(stats.totalDuration)}**`, inline: true },
        { name: 'Active Calls', value: `**${stats.activeCalls}**`, inline: true },
        { name: 'Pending Appeals', value: `**${stats.pendingAppeals}**`, inline: true },
        { name: 'Permanent Bans', value: `**${stats.permanentBans}**`, inline: true },
      ]);

      await interaction.editReply(v2Payload([container]));
      return;
    }
  },
};

export default command;
