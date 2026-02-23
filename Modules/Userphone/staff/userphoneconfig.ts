import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getUserphoneConfig } from '../helpers';

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

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📞 Userphone Settings')
        .addFields(
          { name: 'Allowed Channels', value: channels },
          { name: 'Max Duration', value: config.maxDuration > 0 ? `${config.maxDuration}s` : 'Unlimited', inline: true },
          { name: 'Attachments', value: config.allowAttachments ? '✅' : '❌', inline: true },
          { name: 'Show Server Name', value: config.showServerName ? '✅' : '❌', inline: true },
          { name: 'Call Cooldown', value: `${config.callCooldown}s`, inline: true },
          { name: 'Blacklisted Servers', value: config.blacklistedServers.length > 0 ? config.blacklistedServers.join(', ') : 'None', inline: true },
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      const config = await getUserphoneConfig(guild.id);
      const channels = [...config.allowedChannels];

      const idx = channels.indexOf(channel.id);
      if (idx >= 0) {
        channels.splice(idx, 1);
        await moduleConfig.updateConfig(guild.id, 'userphone', { allowedChannels: channels });
        await interaction.reply({ content: `✅ Removed <#${channel.id}> from allowed channels.` });
      } else {
        channels.push(channel.id);
        await moduleConfig.updateConfig(guild.id, 'userphone', { allowedChannels: channels });
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
  },
};

export default command;
