import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getUserphoneConfig } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('userphoneconfig')
    .setDescription('Configure userphone settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current userphone settings'))
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Add or remove an allowed channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to toggle')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('blacklist')
        .setDescription('Add or remove a server from the blacklist')
        .addStringOption(opt =>
          opt.setName('server_id')
            .setDescription('Server ID to toggle')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('duration')
        .setDescription('Set max call duration')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Max duration in seconds (0 = unlimited, max 1800)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(1800)))
    .addSubcommand(sub =>
      sub.setName('attachments')
        .setDescription('Toggle attachments in calls')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Allow attachments')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('showserver')
        .setDescription('Toggle showing server name during calls')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Show server name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reportchannel')
        .setDescription('Set the channel where userphone reports are sent')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Report channel (leave empty to disable)')
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('filter')
        .setDescription('Configure content filter for incoming messages')
        .addStringOption(opt =>
          opt.setName('setting')
            .setDescription('Filter setting to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'Block NSFW', value: 'blockNSFW' },
              { name: 'Block Profanity', value: 'blockProfanity' },
              { name: 'Block Links', value: 'blockLinks' },
            ))
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable this filter')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('blockedwords')
        .setDescription('Add or remove a custom blocked word')
        .addStringOption(opt =>
          opt.setName('word')
            .setDescription('Word to add/remove from the block list')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('messageformat')
        .setDescription('Set how incoming messages appear in this server')
        .addStringOption(opt =>
          opt.setName('format')
            .setDescription('Message display format')
            .setRequired(true)
            .addChoices(
              { name: 'Embed (default)', value: 'embed' },
              { name: 'Plain Text', value: 'plain' },
            )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.userphoneconfig',
  premiumFeature: 'userphone.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const config = await getUserphoneConfig(guild.id);

      const channels = config.allowedChannels.length > 0
        ? config.allowedChannels.map(id => `<#${id}>`).join(', ')
        : 'Any channel';

      const filterStatus = [
        config.contentFilter.blockNSFW ? '✅ Block NSFW' : '❌ Block NSFW',
        config.contentFilter.blockProfanity ? '✅ Block Profanity' : '❌ Block Profanity',
        config.contentFilter.blockLinks ? '✅ Block Links' : '❌ Block Links',
      ].join('\n');

      const blockedWords = config.contentFilter.customBlockedWords.length > 0
        ? config.contentFilter.customBlockedWords.map(w => `\`${w}\``).join(', ')
        : 'None';

      const container = moduleContainer('userphone');
      addText(container, '### 📞 Userphone Settings');
      addFields(container, [
        { name: 'Allowed Channels', value: channels },
        { name: 'Max Duration', value: config.maxDuration > 0 ? `${config.maxDuration}s` : 'Unlimited', inline: true },
        { name: 'Attachments', value: config.allowAttachments ? '✅' : '❌', inline: true },
        { name: 'Show Server Name', value: config.showServerName ? '✅' : '❌', inline: true },
        { name: 'Call Cooldown', value: `${config.callCooldown}s`, inline: true },
        { name: 'Report Channel', value: config.reportChannelId ? `<#${config.reportChannelId}>` : 'Not set', inline: true },
        { name: 'Message Format', value: config.messageFormat === 'plain' ? '📝 Plain Text' : '📦 Container', inline: true },
        { name: 'Blacklisted Servers', value: config.blacklistedServers.length > 0 ? config.blacklistedServers.join(', ') : 'None' },
        { name: 'Content Filter', value: filterStatus },
        { name: 'Custom Blocked Words', value: blockedWords },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      const config = await getUserphoneConfig(guild.id);
      const list = [...config.allowedChannels];

      const idx = list.indexOf(channel.id);
      if (idx >= 0) {
        list.splice(idx, 1);
        await moduleConfig.updateConfig(guild.id, 'userphone', { allowedChannels: list });
        await interaction.reply({ content: `✅ Removed <#${channel.id}> from allowed channels.` });
      } else {
        list.push(channel.id);
        await moduleConfig.updateConfig(guild.id, 'userphone', { allowedChannels: list });
        await interaction.reply({ content: `✅ Added <#${channel.id}> to allowed channels.` });
      }
      return;
    }

    if (sub === 'blacklist') {
      const serverId = interaction.options.getString('server_id', true);
      const config = await getUserphoneConfig(guild.id);
      const list = [...config.blacklistedServers];

      const idx = list.indexOf(serverId);
      if (idx >= 0) {
        list.splice(idx, 1);
        await moduleConfig.updateConfig(guild.id, 'userphone', { blacklistedServers: list });
        await interaction.reply({ content: `✅ Removed \`${serverId}\` from blacklist.` });
      } else {
        list.push(serverId);
        await moduleConfig.updateConfig(guild.id, 'userphone', { blacklistedServers: list });
        await interaction.reply({ content: `✅ Added \`${serverId}\` to blacklist.` });
      }
      return;
    }

    if (sub === 'duration') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'userphone', { maxDuration: seconds });
      await interaction.reply({ content: `✅ Max call duration set to **${seconds > 0 ? `${seconds}s` : 'unlimited'}**.` });
      return;
    }

    if (sub === 'attachments') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'userphone', { allowAttachments: enabled });
      await interaction.reply({ content: `✅ Attachments in calls ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'showserver') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'userphone', { showServerName: enabled });
      await interaction.reply({ content: `✅ Server name display ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'reportchannel') {
      const channel = interaction.options.getChannel('channel');
      const channelId = channel?.id || null;
      await moduleConfig.updateConfig(guild.id, 'userphone', { reportChannelId: channelId });
      if (channelId) {
        await interaction.reply({ content: `✅ Report channel set to <#${channelId}>.` });
      } else {
        await interaction.reply({ content: '✅ Report channel cleared.' });
      }
      return;
    }

    if (sub === 'filter') {
      const setting = interaction.options.getString('setting', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const config = await getUserphoneConfig(guild.id);

      const updatedFilter = { ...config.contentFilter };
      if (setting === 'blockNSFW') updatedFilter.blockNSFW = enabled;
      else if (setting === 'blockProfanity') updatedFilter.blockProfanity = enabled;
      else if (setting === 'blockLinks') updatedFilter.blockLinks = enabled;

      await moduleConfig.updateConfig(guild.id, 'userphone', { contentFilter: updatedFilter });

      const settingName = setting === 'blockNSFW' ? 'NSFW blocking'
        : setting === 'blockProfanity' ? 'Profanity blocking'
        : 'Link blocking';
      await interaction.reply({ content: `✅ ${settingName} ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'blockedwords') {
      const word = interaction.options.getString('word', true).toLowerCase().trim();
      const config = await getUserphoneConfig(guild.id);
      const list = [...config.contentFilter.customBlockedWords];

      const idx = list.indexOf(word);
      if (idx >= 0) {
        list.splice(idx, 1);
        const updatedFilter = { ...config.contentFilter, customBlockedWords: list };
        await moduleConfig.updateConfig(guild.id, 'userphone', { contentFilter: updatedFilter });
        await interaction.reply({ content: `✅ Removed \`${word}\` from blocked words.` });
      } else {
        list.push(word);
        const updatedFilter = { ...config.contentFilter, customBlockedWords: list };
        await moduleConfig.updateConfig(guild.id, 'userphone', { contentFilter: updatedFilter });
        await interaction.reply({ content: `✅ Added \`${word}\` to blocked words.` });
      }
      return;
    }

    if (sub === 'messageformat') {
      const format = interaction.options.getString('format', true) as 'embed' | 'plain';
      await moduleConfig.updateConfig(guild.id, 'userphone', { messageFormat: format });
      const label = format === 'plain' ? '📝 Plain Text' : '📦 Embed';
      await interaction.reply({ content: `✅ Incoming message format set to **${label}**.` });
      return;
    }
  },
};

export default command;
