import { Events, Collection, Message } from 'discord.js';
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

          await logToChannel(message.guild, {
            title: '👻 Ghost Ping Detected',
            description: `A message with mentions was deleted.\n\n**Mentioned:** ${mentionStr}`,
            color: '#FF6B6B',
            fields: [
              { name: 'Author', value: `<@${message.author?.id}>`, inline: true },
              { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
              { name: 'Message Content', value: message.content || '*(no text)*', inline: false }
            ],
            timestamp: new Date()
          });
        }
      }

      // Log deletion
      if (config.logDeletes && config.logChannelId) {
        const fields: Array<{ name: string; value: string; inline?: boolean }> = [
          { name: 'Author', value: `<@${message.author?.id}>`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}>`, inline: true }
        ];

        if (message.attachments.size > 0) {
          fields.push({ name: 'Attachments', value: message.attachments.map((a) => a.name).join(', ') });
        }

        await logToChannel(message.guild, {
          title: '🗑️ Message Deleted',
          description: message.content || '*(no text)*',
          color: '#FFA500',
          fields,
          thumbnail: message.author?.displayAvatarURL({ size: 256 }) || null,
          timestamp: new Date()
        });
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
        await logToChannel(newMessage.guild, {
          title: '✏️ Message Edited',
          description: '',
          color: '#4DA6FF',
          fields: [
            { name: 'Author', value: `<@${newMessage.author?.id}>`, inline: true },
            { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
            { name: 'Before', value: (oldMessage.content || '*(no text)*').slice(0, 1024), inline: false },
            { name: 'After', value: (newMessage.content || '*(no text)*').slice(0, 1024), inline: false }
          ],
          thumbnail: newMessage.author?.displayAvatarURL({ size: 256 }) || null,
          timestamp: new Date()
        });
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

        await logToChannel(sample.guild, {
          title: '🗑️ Bulk Delete',
          description: '',
          color: '#FF4444',
          fields: [
            { name: 'Count', value: `${messages.size} messages`, inline: true },
            { name: 'Channel', value: `<#${sample.channel.id}>`, inline: true },
            { name: 'Sample Messages', value: sampleMessages || '*(no messages)*', inline: false }
          ],
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Error in MessageBulkDelete handler:`, error);
    }
  },
};

export const messageTrackingEvents: ModuleEvent[] = [messageDeleteEvent, messageUpdateEvent, messageBulkDeleteEvent];
