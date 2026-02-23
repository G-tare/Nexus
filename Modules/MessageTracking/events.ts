import { Events, Collection, EmbedBuilder, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getMessageTrackingConfig,
  storeDeletedMessage,
  storeEditedMessage,
  checkGhostPing,
  logToChannel,
  shouldIgnoreChannel,
} from './helpers';

const logger = createModuleLogger('MessageTracking');

const messageDeleteEvent: ModuleEvent = { event: Events.MessageDelete,
  handler: async (message: Message) => {
    if (!message.guild) return;

    try {
      const config = await getMessageTrackingConfig(message.guild.id);
      if (!config.enabled) return;
      if (message.author?.bot && config.ignoreBots) return;
      if (await shouldIgnoreChannel(message.guild.id, message.channel.id)) return;

      // Store for snipe command
      if (config.snipeEnabled) {
        await storeDeletedMessage(message.guild.id, message.channel.id, message);
      }

      // Check for ghost ping
      if (config.ghostPingAlert && config.logChannelId) {
        const { hasMentions, mentions } = checkGhostPing(message);

        if (hasMentions) {
          const mentionStr = mentions.map((m) => `${m.type === 'user' ? '@' : '@&'}${m.name}`).join(', ');

          const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('👻 Ghost Ping Detected')
            .setDescription(`A message with mentions was deleted.\n\n**Mentioned:** ${mentionStr}`)
            .addFields(
              { name: 'Author', value: `<@${message.author?.id}>`, inline: true },
              { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
              { name: 'Message Content', value: message.content || '*(no text)*', inline: false }
            )
            .setTimestamp();

          await logToChannel(message.guild, embed);
        }
      }

      // Log deletion
      if (config.logDeletes && config.logChannelId) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🗑️ Message Deleted')
          .setDescription(message.content || '*(no text)*')
          .addFields(
            { name: 'Author', value: `<@${message.author?.id}>`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
          )
          .setThumbnail(message.author?.displayAvatarURL({ size: 256 }) || null)
          .setTimestamp();

        if (message.attachments.size > 0) {
          embed.addFields({ name: 'Attachments', value: message.attachments.map((a) => a.name).join(', ') });
        }

        await logToChannel(message.guild, embed);
      }
    } catch (error) {
      logger.error(`Error in MessageDelete handler:`, error);
    }
  },
};

const messageUpdateEvent: ModuleEvent = { event: Events.MessageUpdate,
  handler: async (oldMessage: Message, newMessage: Message) => {
    if (!newMessage.guild || newMessage.system) return;

    try {
      const config = await getMessageTrackingConfig(newMessage.guild.id);
      if (!config.enabled) return;
      if (newMessage.author?.bot && config.ignoreBots) return;
      if (await shouldIgnoreChannel(newMessage.guild.id, newMessage.channel.id)) return;
      if (oldMessage.content === newMessage.content) return;

      // Store for editsnipe command
      if (config.snipeEnabled) {
        await storeEditedMessage(newMessage.guild.id, newMessage.channel.id, oldMessage, newMessage);
      }

      // Log edit
      if (config.logEdits && config.logChannelId) {
        const embed = new EmbedBuilder()
          .setColor('#4DA6FF')
          .setTitle('✏️ Message Edited')
          .addFields(
            { name: 'Author', value: `<@${newMessage.author?.id}>`, inline: true },
            { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
            { name: 'Before', value: (oldMessage.content || '*(no text)*').slice(0, 1024), inline: false },
            { name: 'After', value: (newMessage.content || '*(no text)*').slice(0, 1024), inline: false }
          )
          .setThumbnail(newMessage.author?.displayAvatarURL({ size: 256 }) || null)
          .setTimestamp();

        await logToChannel(newMessage.guild, embed);
      }
    } catch (error) {
      logger.error(`Error in MessageUpdate handler:`, error);
    }
  },
};

const messageBulkDeleteEvent: ModuleEvent = { event: Events.MessageBulkDelete,
  handler: async (messages: Collection<string, Message>) => {
    const sample = messages.first();
    if (!sample || !sample.guild) return;

    try {
      const config = await getMessageTrackingConfig(sample.guild.id);
      if (!config.enabled) return;
      if (await shouldIgnoreChannel(sample.guild.id, sample.channel.id)) return;

      if (config.logBulkDeletes && config.logChannelId) {
        const sampleMessages = messages
          .last(3)
          ?.map((m) => `**${m.author?.username}:** ${m.content || '*(no text)*'}`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor('#FF4444')
          .setTitle('🗑️ Bulk Delete')
          .addFields(
            { name: 'Count', value: `${messages.size} messages`, inline: true },
            { name: 'Channel', value: `<#${sample.channel.id}>`, inline: true },
            { name: 'Sample Messages', value: sampleMessages || '*(no messages)*', inline: false }
          )
          .setTimestamp();

        await logToChannel(sample.guild, embed);
      }
    } catch (error) {
      logger.error(`Error in MessageBulkDelete handler:`, error);
    }
  },
};

export const messageTrackingEvents: ModuleEvent[] = [messageDeleteEvent, messageUpdateEvent, messageBulkDeleteEvent];
