import { Events, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { getAIConfig, generateResponse, checkAICooldown, setAICooldown } from './helpers';

const logger = createModuleLogger('AIChatbot');

const messageCreate: ModuleEvent = { event: Events.MessageCreate,
  handler: async (message: Message) => {
    try {
      if (message.author.bot) return;
      if (!message.guildId || message.channel.isDMBased()) return;

      const config = await getAIConfig(message.guildId!);
      if (!config.enabled || !config.apiKey) return;

      const isMentioned = message.mentions.has(message.client.user!.id);
      const isAllowedChannel = config.allowedChannels.includes(message.channelId);

      const shouldRespond =
        (config.mentionReply && isMentioned) ||
        (config.autoReply && isAllowedChannel);

      if (!shouldRespond) return;

      const remainingCooldown = await checkAICooldown(message.guildId!, message.author.id);
      if (remainingCooldown > 0) {
        await message.reply({
          content: `⏱️ Please wait ${remainingCooldown}s before asking again.`,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
        return;
      }

      await message.channel.sendTyping().catch(() => {});

      try {
        const response = await generateResponse(
          message.guildId!,
          message.channelId,
          message.content.replace(`<@${message.client.user!.id}>`, '').trim(),
          message.author.username
        );

        await message.reply({
          content: response,
          allowedMentions: { repliedUser: false },
        }).catch(() => {});

        await setAICooldown(message.guildId!, message.author.id, config.cooldown);
      } catch (error) {
        logger.error(`Error generating AI response in ${message.guildId!}/${message.channelId}`, error);
        await message.reply({
          content: '❌ Failed to generate response. Please try again later.',
          allowedMentions: { repliedUser: false },
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('Error in MessageCreate handler', error);
    }
  },
};

export const aiChatbotEvents: ModuleEvent[] = [messageCreate];
