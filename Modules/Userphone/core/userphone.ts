import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getActiveCall,
  getUserphoneConfig,
  isOnCallCooldown,
  findMatch,
  joinQueue,
  startCall,
  setCallCooldown,
  isServerBanned,
  isUserBanned,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('userphone')
    .setDescription('Start a cross-server phone call') as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.userphone',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channel = interaction.channel!;
    const config = await getUserphoneConfig(guild.id);

    // Check allowed channels
    if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(channel.id)) {
      await interaction.reply({
        content: `❌ Userphone can only be used in: ${config.allowedChannels.map(id => `<#${id}>`).join(', ')}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if already in a call
    const existingCall = await getActiveCall(channel.id);
    if (existingCall) {
      await interaction.reply({
        content: '📞 This channel already has an active call. Use `/hangup` to end it first.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check cooldown
    if (await isOnCallCooldown(guild.id, channel.id)) {
      await interaction.reply({
        content: '⏳ Please wait before starting another call.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if server is banned from userphone
    if (await isServerBanned(guild.id)) {
      await interaction.reply({
        content: '🚫 This server has been restricted from using userphone.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if user is individually banned from userphone
    const userBan = await isUserBanned(interaction.user.id);
    if (userBan.banned) {
      await interaction.reply({
        content: `🚫 You have been ${userBan.permanent ? 'permanently' : 'temporarily'} restricted from using userphone.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Try to find a match
    const match = await findMatch(guild.id, channel.id);

    if (match) {
      // Connect!
      const call = await startCall(
        { guildId: guild.id, channelId: channel.id, guildName: guild.name },
        { guildId: match.guildId, channelId: match.channelId, guildName: match.guildName },
      );

      const container1 = moduleContainer('userphone');
      addText(container1, `### 📞 Connected!\nYou're now connected to ${config.showServerName ? `**${match.guildName}**` : 'another server'}.\n\nType messages here to talk. Use \`/hangup\` to end the call.`);
      addFooter(container1, `Max duration: ${call.maxDuration > 0 ? `${Math.floor(call.maxDuration / 60)}m` : 'Unlimited'}`);

      await interaction.editReply(v2Payload([container1]));

      // Notify the other side
      try {
        const otherGuild = interaction.client.guilds.cache.get(match.guildId);
        if (otherGuild) {
          const otherChannel = await otherGuild.channels.fetch(match.channelId).catch(() => null);
          if (otherChannel && 'send' in otherChannel) {
            const otherConfig = await getUserphoneConfig(match.guildId);
            const container2 = moduleContainer('userphone');
            addText(container2, `### 📞 Connected!\nYou're now connected to ${otherConfig.showServerName ? `**${guild.name}**` : 'another server'}.\n\nType messages here to talk. Use \`/hangup\` to end the call.`);
            addFooter(container2, `Max duration: ${call.maxDuration > 0 ? `${Math.floor(call.maxDuration / 60)}m` : 'Unlimited'}`);

            await (otherChannel as any).send(v2Payload([container2]));
          }
        }
      } catch {}
    } else {
      // Join the queue
      await joinQueue(guild.id, channel.id, guild.name);

      const container = moduleContainer('userphone');
      addText(container, `### 📞 Searching...\nLooking for another server to connect with.\n\nYou'll be automatically connected when someone else calls. This expires in **2 minutes**.`);
      addFooter(container, 'Waiting for a match...');

      await interaction.editReply(v2Payload([container]));
    }
  },
};

export default command;
