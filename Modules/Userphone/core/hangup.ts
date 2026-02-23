import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getActiveCall,
  getOtherSide,
  endCall,
  leaveQueue,
  setCallCooldown,
  formatDuration,
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
      await interaction.reply({ content: '📞 Removed from the call queue.', ephemeral: true });
      return;
    }

    const otherSide = getOtherSide(call, channel.id);
    const duration = Math.floor((Date.now() - call.startedAt) / 1000);

    await endCall(call.callId);
    await setCallCooldown(guild.id, channel.id);

    await interaction.reply({
      content: `📞 **Call ended.** Duration: ${formatDuration(duration)}`,
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
            });
            await setCallCooldown(otherSide.guildId, otherSide.channelId);
          }
        }
      } catch {}
    }
  },
};

export default command;
