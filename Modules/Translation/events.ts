import { Events, Message, MessageReaction, User, TextChannel, PartialMessageReaction, PartialUser } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { v2Payload } from '../../Shared/src/utils/componentsV2';
import {
  getTranslationConfig,
  getChannelLanguage,
  translateText,
  sendTranslatedWebhook,
  FLAG_TO_LANGUAGE,
  buildTranslationEmbed,
  checkTranslateCooldown,
  setTranslateCooldown,
  incrementTranslationStats,
  SUPPORTED_LANGUAGES,
} from './helpers';

const logger = createModuleLogger('Translation:Events');

/**
 * Auto-translate messages in configured channels.
 */
const autoTranslateHandler: ModuleEvent = { event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;
    if (!message.content || message.content.length < 2) return;

    const guildId = message.guild.id;

    try {
      const targetLang = await getChannelLanguage(guildId, message.channel.id);
      if (!targetLang) return;

      const config = await getTranslationConfig(guildId);

      if (message.content.length < config.minLength) return;

      // Check cooldown
      const onCooldown = await checkTranslateCooldown(guildId, message.author.id);
      if (onCooldown) return;

      const result = await translateText(guildId, message.content, targetLang);
      if (!result) return;

      // Don't translate if source and target are the same
      if (result.sourceLang === targetLang || result.detectedLanguage === targetLang) return;

      // Don't post if translation is identical to original
      if (result.translatedText.toLowerCase().trim() === message.content.toLowerCase().trim()) return;

      // Set cooldown
      await setTranslateCooldown(guildId, message.author.id, config.userCooldown);

      // Send translation
      if (config.useWebhooks && message.channel instanceof TextChannel) {
        await sendTranslatedWebhook(message.channel, message, result.translatedText, targetLang);
      } else {
        const embed = buildTranslationEmbed(result, message.content);
        await message.reply({ ...v2Payload([embed]), allowedMentions: { repliedUser: false } });
      }

      // Stats
      await incrementTranslationStats(guildId, result.sourceLang, targetLang);

      logger.debug('Auto-translated message', {
        guild: guildId,
        channel: message.channel.id,
        from: result.sourceLang,
        to: targetLang,
      });
    } catch (err: any) {
      logger.error('Auto-translate failed', { error: err.message });
    }
  },
};

/**
 * Flag emoji reaction → translate message to that language.
 */
const flagReactionHandler: ModuleEvent = { event: Events.MessageReactionAdd,
  async handler(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    // Fetch partials
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const message = reaction.message as Message;
    if (!message.guild) return;

    const guildId = message.guild.id;

    try {
      const config = await getTranslationConfig(guildId);
      if (!config.flagReactions) return;

      const emoji = reaction.emoji.name;
      if (!emoji) return;

      const targetLang = FLAG_TO_LANGUAGE[emoji];
      if (!targetLang) return;

      // Need message content
      if (!message.content || message.content.length < 2) return;

      // Check cooldown
      const onCooldown = await checkTranslateCooldown(guildId, user.id);
      if (onCooldown) return;

      const result = await translateText(guildId, message.content, targetLang);
      if (!result) return;

      // Don't translate if same language
      if (result.sourceLang === targetLang || result.detectedLanguage === targetLang) return;

      await setTranslateCooldown(guildId, user.id, config.userCooldown);

      const embed = buildTranslationEmbed(result, message.content, (user as User).displayName);
      await message.reply({ ...v2Payload([embed]), allowedMentions: { repliedUser: false } });

      await incrementTranslationStats(guildId, result.sourceLang, targetLang);

      logger.debug('Flag reaction translation', {
        guild: guildId,
        emoji,
        from: result.sourceLang,
        to: targetLang,
      });
    } catch (err: any) {
      logger.error('Flag reaction translate failed', { error: err.message });
    }
  },
};

export const translationEvents: ModuleEvent[] = [
  autoTranslateHandler,
  flagReactionHandler,
];
