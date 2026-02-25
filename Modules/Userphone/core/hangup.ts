import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getActiveCall,
  getOtherSide,
  endCall,
  leaveQueue,
  setCallCooldown,
  formatDuration,
  storeLastCallInfo,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('hangup')
    .setDescription('End the current userphone call') as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.hangup',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channel = interaction.channel!;

    const call = await getActiveCall(channel.id);

    if (!call) {
      // Maybe they're in queue
      await leaveQueue(channel.id);
      await interaction.reply({ content: '📞 Removed from the call queue.', flags: MessageFlags.Ephemeral });
      return;
    }

    const otherSide = getOtherSide(call, channel.id);
    const duration = Math.floor((Date.now() - call.startedAt) / 1000);

    // Store last call info for reporting
    if (otherSide) {
      await storeLastCallInfo(channel.id, call.callId, otherSide.guildId, otherSide.guildName);
      const mySide = call.side1.channelId === channel.id ? call.side1 : call.side2;
      await storeLastCallInfo(otherSide.channelId, call.callId, mySide.guildId, mySide.guildName);
    }

    await endCall(call.callId);
    await setCallCooldown(guild.id, channel.id);

    const postCallRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`userphone_save_contact_${call.callId}`)
        .setLabel('Save Contact')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📒'),
      new ButtonBuilder()
        .setCustomId(`userphone_report_${call.callId}`)
        .setLabel('Report Server')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚩'),
    );

    await interaction.reply({
      content: `📞 **Call ended.** Duration: ${formatDuration(duration)}`,
      components: [postCallRow],
    });

    // Notify the other side
    if (otherSide) {
      try {
        const otherGuild = interaction.client.guilds.cache.get(otherSide.guildId);
        if (otherGuild) {
          const otherChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null);
          if (otherChannel && 'send' in otherChannel) {
            await (otherChannel as TextChannel).send({
              content: `📞 **The other side hung up.** Call duration: ${formatDuration(duration)}`,
              components: [postCallRow],
            });
            await setCallCooldown(otherSide.guildId, otherSide.channelId);
          }
        }
      } catch {}
    }
  },
};

export default command;
