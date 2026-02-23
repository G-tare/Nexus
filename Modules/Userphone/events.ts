import { Events, Message, Client, TextChannel } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getActiveCall,
  getOtherSide,
  relayMessage,
  endCall,
  getUserphoneConfig,
} from './helpers';

const logger = createModuleLogger('Userphone:Events');

/**
 * Relay messages during active calls.
 */
const messageRelayHandler: ModuleEvent = { event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;
    if (!message.content && message.attachments.size === 0) return;

    // Check if this channel has an active call
    const call = await getActiveCall(message.channel.id);
    if (!call) return;

    // Get the other side
    const otherSide = getOtherSide(call, message.channel.id);
    if (!otherSide) return;

    // Check if channel is allowed
    const config = await getUserphoneConfig(message.guild.id);
    if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(message.channel.id)) return;

    // Check max duration
    const elapsed = (Date.now() - call.startedAt) / 1000;
    if (call.maxDuration > 0 && elapsed > call.maxDuration) {
      // Auto-hang up
      await endCall(call.callId);
      await (message.channel as any).send({ content: '📞 **Call ended** — maximum duration reached.' }).catch(() => {});

      try {
        const client = message.client;
        const otherGuild = client.guilds.cache.get(otherSide.guildId);
        if (otherGuild) {
          const otherChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null);
          if (otherChannel && 'send' in otherChannel) {
            await (otherChannel as TextChannel).send({ content: '📞 **Call ended** — maximum duration reached.' });
          }
        }
      } catch {}
      return;
    }

    // Get other side config for showServerName
    const otherConfig = await getUserphoneConfig(otherSide.guildId);

    // Relay the message
    try {
      const client = message.client;
      const otherGuild = client.guilds.cache.get(otherSide.guildId);
      if (!otherGuild) {
        await endCall(call.callId);
        await (message.channel as any).send({ content: '📞 **Call ended** — the other server is no longer available.' }).catch(() => {});
        return;
      }

      const targetChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null) as TextChannel | null;
      if (!targetChannel) {
        await endCall(call.callId);
        await (message.channel as any).send({ content: '📞 **Call ended** — the other channel was deleted.' }).catch(() => {});
        return;
      }

      await relayMessage(message, call, targetChannel, otherConfig.showServerName);
    } catch (err: any) {
      logger.error('Message relay error', { error: err.message });
    }
  },
};

export const userphoneEvents: ModuleEvent[] = [
  messageRelayHandler,
];
