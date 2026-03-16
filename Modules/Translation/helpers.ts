import {
  Guild,
  Message,
  TextChannel,
  WebhookClient,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eq, and, sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { v2Payload } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Translation');

// ============================================
// Translation Module Config Interface
// ============================================

export interface TranslationConfig {
  /** Translation provider: 'google' (free) or 'libre' (self-hosted) */
  provider: 'google' | 'libre';
  /** LibreTranslate instance URL (if provider is 'libre') */
  libreUrl: string;
  /** LibreTranslate API key (optional) */
  libreApiKey: string;
  /** Enable flag emoji reactions to translate */
  flagReactions: boolean;
  /** Auto-detect source language */
  autoDetect: boolean;
  /** Default target language for the server */
  defaultLanguage: string;
  /** Whether to use webhooks for translated messages (preserves username/avatar) */
  useWebhooks: boolean;
  /** Minimum message length to auto-translate */
  minLength: number;
  /** Maximum characters per translation request */
  maxLength: number;
  /** Cooldown between translations per user (seconds) */
  userCooldown: number;
}

// ============================================
// Supported Languages
// ============================================

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  af: 'Afrikaans',
  sq: 'Albanian',
  am: 'Amharic',
  ar: 'Arabic',
  hy: 'Armenian',
  az: 'Azerbaijani',
  eu: 'Basque',
  be: 'Belarusian',
  bn: 'Bengali',
  bs: 'Bosnian',
  bg: 'Bulgarian',
  ca: 'Catalan',
  ceb: 'Cebuano',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  co: 'Corsican',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  eo: 'Esperanto',
  et: 'Estonian',
  fi: 'Finnish',
  fr: 'French',
  fy: 'Frisian',
  gl: 'Galician',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  gu: 'Gujarati',
  ht: 'Haitian Creole',
  ha: 'Hausa',
  haw: 'Hawaiian',
  he: 'Hebrew',
  hi: 'Hindi',
  hmn: 'Hmong',
  hu: 'Hungarian',
  is: 'Icelandic',
  ig: 'Igbo',
  id: 'Indonesian',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  jv: 'Javanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  km: 'Khmer',
  rw: 'Kinyarwanda',
  ko: 'Korean',
  ku: 'Kurdish',
  ky: 'Kyrgyz',
  lo: 'Lao',
  la: 'Latin',
  lv: 'Latvian',
  lt: 'Lithuanian',
  lb: 'Luxembourgish',
  mk: 'Macedonian',
  mg: 'Malagasy',
  ms: 'Malay',
  ml: 'Malayalam',
  mt: 'Maltese',
  mi: 'Maori',
  mr: 'Marathi',
  mn: 'Mongolian',
  my: 'Myanmar (Burmese)',
  ne: 'Nepali',
  no: 'Norwegian',
  ny: 'Nyanja (Chichewa)',
  or: 'Odia (Oriya)',
  ps: 'Pashto',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  pa: 'Punjabi',
  ro: 'Romanian',
  ru: 'Russian',
  sm: 'Samoan',
  gd: 'Scots Gaelic',
  sr: 'Serbian',
  st: 'Sesotho',
  sn: 'Shona',
  sd: 'Sindhi',
  si: 'Sinhala (Sinhalese)',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  es: 'Spanish',
  su: 'Sundanese',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog (Filipino)',
  tg: 'Tajik',
  ta: 'Tamil',
  tt: 'Tatar',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  tk: 'Turkmen',
  uk: 'Ukrainian',
  ur: 'Urdu',
  ug: 'Uyghur',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  cy: 'Welsh',
  xh: 'Xhosa',
  yi: 'Yiddish',
  yo: 'Yoruba',
  zu: 'Zulu',
};

/**
 * Country flag emoji to language code mapping.
 * Flag emojis are regional indicator pairs (e.g. 🇺🇸 = U+1F1FA U+1F1F8).
 */
export const FLAG_TO_LANGUAGE: Record<string, string> = {
  '🇺🇸': 'en', '🇬🇧': 'en', '🇦🇺': 'en',
  '🇫🇷': 'fr', '🇩🇪': 'de', '🇪🇸': 'es', '🇲🇽': 'es',
  '🇮🇹': 'it', '🇵🇹': 'pt', '🇧🇷': 'pt',
  '🇷🇺': 'ru', '🇯🇵': 'ja', '🇰🇷': 'ko',
  '🇨🇳': 'zh', '🇹🇼': 'zh-TW', '🇭🇰': 'zh-TW',
  '🇸🇦': 'ar', '🇪🇬': 'ar', '🇮🇳': 'hi',
  '🇹🇷': 'tr', '🇳🇱': 'nl', '🇧🇪': 'nl',
  '🇵🇱': 'pl', '🇸🇪': 'sv', '🇳🇴': 'no',
  '🇩🇰': 'da', '🇫🇮': 'fi', '🇬🇷': 'el',
  '🇨🇿': 'cs', '🇷🇴': 'ro', '🇭🇺': 'hu',
  '🇧🇬': 'bg', '🇭🇷': 'hr', '🇷🇸': 'sr',
  '🇺🇦': 'uk', '🇹🇭': 'th', '🇻🇳': 'vi',
  '🇮🇩': 'id', '🇲🇾': 'ms', '🇵🇭': 'tl',
  '🇮🇱': 'he', '🇮🇷': 'fa', '🇵🇰': 'ur',
  '🇧🇩': 'bn', '🇪🇹': 'am', '🇰🇪': 'sw',
  '🇿🇦': 'af', '🇮🇪': 'ga', '🏴󠁧󠁢󠁷󠁬󠁳󠁿': 'cy',
};

// ============================================
// Translation API
// ============================================

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  sourceLang: string;
  targetLang: string;
}

/**
 * Get the translation config for a guild.
 */
export async function getTranslationConfig(guildId: string): Promise<TranslationConfig> {
  const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'translation');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
  return {
    provider: config?.provider ?? 'google',
    libreUrl: config?.libreUrl ?? 'http://localhost:5000',
    libreApiKey: config?.libreApiKey ?? '',
    flagReactions: config?.flagReactions ?? true,
    autoDetect: config?.autoDetect ?? true,
    defaultLanguage: config?.defaultLanguage ?? 'en',
    useWebhooks: config?.useWebhooks ?? true,
    minLength: config?.minLength ?? 2,
    maxLength: config?.maxLength ?? 2000,
    userCooldown: config?.userCooldown ?? 5,
  };
}

/**
 * Translate text using the configured provider.
 */
export async function translateText(
  guildId: string,
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<TranslationResult | null> {
  const config = await getTranslationConfig(guildId);
  // Using global cache;

  // Trim text to max length
  const trimmedText = text.slice(0, config.maxLength);

  // Check cache
  const cacheKey = `translate:${guildId}:${sourceLang || 'auto'}:${targetLang}:${Buffer.from(trimmedText).toString('base64').slice(0, 128)}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as TranslationResult;
    } catch {
      // Cache corrupted, continue
    }
  }

  let result: TranslationResult | null = null;

  if (config.provider === 'libre') {
    result = await translateLibre(config, trimmedText, targetLang, sourceLang);
  } else {
    result = await translateGoogle(trimmedText, targetLang, sourceLang);
  }

  // Cache for 1 hour
  if (result) {
    cache.set(cacheKey, JSON.stringify(result), 3600);
  }

  return result;
}

/**
 * Translate using Google Translate (free, unofficial endpoint).
 */
async function translateGoogle(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<TranslationResult | null> {
  try {
    const sl = sourceLang || 'auto';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NexusBot/1.0)',
      },
    });

    if (!response.ok) {
      logger.error('Google Translate API error', { status: response.status });
      return null;
    }

    const data = await response.json() as any;

    if (!data || !data[0]) return null;

    // data[0] is array of [translated_segment, original_segment, ...]
    const translatedText = data[0]
      .filter((segment: any) => segment && segment[0])
      .map((segment: any) => segment[0])
      .join('');

    const detectedLang = data[2] || sl;

    return {
      translatedText,
      detectedLanguage: detectedLang !== 'auto' ? detectedLang : undefined,
      sourceLang: detectedLang === 'auto' ? (data[2] || 'unknown') : sl,
      targetLang,
    };
  } catch (err: any) {
    logger.error('Google Translate error', { error: err.message });
    return null;
  }
}

/**
 * Translate using LibreTranslate (self-hosted).
 */
async function translateLibre(
  config: TranslationConfig,
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<TranslationResult | null> {
  try {
    const body: Record<string, any> = {
      q: text,
      source: sourceLang || 'auto',
      target: targetLang,
      format: 'text',
    };
    if (config.libreApiKey) {
      body.api_key = config.libreApiKey;
    }

    const response = await fetch(`${config.libreUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error('LibreTranslate API error', { status: response.status });
      return null;
    }

    const data = await response.json() as any;

    return {
      translatedText: data.translatedText,
      detectedLanguage: data.detectedLanguage?.language,
      sourceLang: sourceLang || data.detectedLanguage?.language || 'auto',
      targetLang,
    };
  } catch (err: any) {
    logger.error('LibreTranslate error', { error: err.message });
    return null;
  }
}

/**
 * Detect the language of a text string.
 */
export async function detectLanguage(guildId: string, text: string): Promise<string | null> {
  const result = await translateText(guildId, text, 'en'); // translate to EN just to detect
  return result?.detectedLanguage || result?.sourceLang || null;
}

// ============================================
// Channel Auto-Translation
// ============================================

export interface ChannelTranslation {
  guildId: string;
  channelId: string;
  targetLang: string;
  createdBy: string;
  createdAt: number;
}

/**
 * Set a channel for auto-translation.
 */
export async function setChannelTranslation(
  guildId: string,
  channelId: string,
  targetLang: string,
  createdBy: string,
): Promise<void> {
  const db = getDb();
  // Using global cache;

  await db.execute(sql`
    INSERT INTO translation_channels (guild_id, channel_id, target_lang, created_by, created_at)
    VALUES (${guildId}, ${channelId}, ${targetLang}, ${createdBy}, ${Date.now()})
    ON CONFLICT (guild_id, channel_id)
    DO UPDATE SET target_lang = ${targetLang}, created_by = ${createdBy}
  `);

  // Cache it
  cache.hset(`translate:channels:${guildId}`, channelId, targetLang);

  logger.info('Channel translation set', { guildId, channelId, targetLang });
}

/**
 * Remove auto-translation from a channel.
 */
export async function removeChannelTranslation(
  guildId: string,
  channelId: string,
): Promise<boolean> {
  const db = getDb();
  // Using global cache;

  const result = await db.execute(sql`
    DELETE FROM translation_channels
    WHERE guild_id = ${guildId} AND channel_id = ${channelId}
  `);

  // Remove from cache by setting to empty or use delete-by-prefix approach
  // For now, we'll just let it expire naturally since cache manager doesn't have hdel
  // If immediate removal is needed, use deleteByPrefix for the entire guild's channels

  return (result as any).rowCount > 0;
}

/**
 * Get the target language for a channel, or null if not configured.
 */
export async function getChannelLanguage(
  guildId: string,
  channelId: string,
): Promise<string | null> {
  // Using global cache;

  // Check cache first
  const cached = cache.hget(`translate:channels:${guildId}`, channelId);
  if (cached) return cached;

  const db = getDb();
  const rows = await db.execute(sql`
    SELECT target_lang FROM translation_channels
    WHERE guild_id = ${guildId} AND channel_id = ${channelId}
    LIMIT 1
  `);

  const row = (rows as any).rows?.[0];
  if (row) {
    cache.hset(`translate:channels:${guildId}`, channelId, row.target_lang);
    return row.target_lang;
  }

  return null;
}

/**
 * Get all auto-translate channels for a guild.
 */
export async function getAllChannelTranslations(guildId: string): Promise<ChannelTranslation[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT guild_id, channel_id, target_lang, created_by, created_at
    FROM translation_channels
    WHERE guild_id = ${guildId}
    ORDER BY created_at DESC
  `);

  return ((rows as any).rows || []) as ChannelTranslation[];
}

// ============================================
// User Language Preferences
// ============================================

/**
 * Set a user's preferred language for a guild.
 */
export async function setUserLanguage(
  guildId: string,
  userId: string,
  lang: string,
): Promise<void> {
  const db = getDb();
  // Using global cache;

  await db.execute(sql`
    INSERT INTO translation_user_prefs (guild_id, user_id, language)
    VALUES (${guildId}, ${userId}, ${lang})
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET language = ${lang}
  `);

  cache.hset(`translate:userprefs:${guildId}`, userId, lang);
}

/**
 * Get a user's preferred language.
 */
export async function getUserLanguage(
  guildId: string,
  userId: string,
): Promise<string | null> {
  // Using global cache;

  const cached = cache.hget(`translate:userprefs:${guildId}`, userId);
  if (cached) return cached;

  const db = getDb();
  const rows = await db.execute(sql`
    SELECT language FROM translation_user_prefs
    WHERE guild_id = ${guildId} AND user_id = ${userId}
    LIMIT 1
  `);

  const row = (rows as any).rows?.[0];
  if (row) {
    cache.hset(`translate:userprefs:${guildId}`, userId, row.language);
    return row.language;
  }

  return null;
}

// ============================================
// Translation Cooldowns
// ============================================

/**
 * Check if a user is on translation cooldown.
 */
export async function checkTranslateCooldown(
  guildId: string,
  userId: string,
): Promise<boolean> {
  // Using global cache;
  const key = `translate:cooldown:${guildId}:${userId}`;
  const exists = cache.has(key);
  return exists;
}

/**
 * Set translation cooldown for a user.
 */
export async function setTranslateCooldown(
  guildId: string,
  userId: string,
  seconds: number,
): Promise<void> {
  // Using global cache;
  const key = `translate:cooldown:${guildId}:${userId}`;
  cache.set(key, '1', seconds);
}

// ============================================
// Translation Statistics
// ============================================

/**
 * Increment translation count for stats.
 */
export async function incrementTranslationStats(
  guildId: string,
  sourceLang: string,
  targetLang: string,
): Promise<void> {
  // Using global cache;
  const today = new Date().toISOString().split('T')[0];

  // Cache manager doesn't have hincrby, so we need to manually increment
  const pairKey = `${sourceLang}>${targetLang}`;
  const dailyKey = `translate:stats:${guildId}:${today}`;
  const totalKey = `translate:stats:${guildId}:total`;

  const dailyCount = cache.hget(dailyKey, pairKey);
  const dailyNum = dailyCount ? parseInt(dailyCount, 10) : 0;
  cache.hset(dailyKey, pairKey, String(dailyNum + 1));

  const totalCount = cache.hget(totalKey, pairKey);
  const totalNum = totalCount ? parseInt(totalCount, 10) : 0;
  cache.hset(totalKey, pairKey, String(totalNum + 1));

  const countTotal = cache.hget(totalKey, 'count');
  const countNum = countTotal ? parseInt(countTotal, 10) : 0;
  cache.hset(totalKey, 'count', String(countNum + 1));

  // Expire daily stats after 30 days
  cache.expire(dailyKey, 60 * 60 * 24 * 30);
}

/**
 * Get total translation count for a guild.
 */
export async function getTranslationCount(guildId: string): Promise<number> {
  // Using global cache;
  const count = cache.hget(`translate:stats:${guildId}:total`, 'count');
  return parseInt(count || '0', 10);
}

// ============================================
// Translation Embed Builder
// ============================================

/**
 * Build a translation result container.
 */
export function buildTranslationEmbed(
  result: TranslationResult,
  originalText: string,
  requestedBy?: string,
): ContainerBuilder {
  const sourceName = SUPPORTED_LANGUAGES[result.sourceLang] || result.sourceLang;
  const targetName = SUPPORTED_LANGUAGES[result.targetLang] || result.targetLang;

  const container = new ContainerBuilder().setAccentColor(0x4285F4);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🌐 Translation'));

  const fromText = originalText.length > 1024 ? originalText.slice(0, 1021) + '...' : originalText;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**From: ${sourceName}**\n${fromText}`));

  const toText = result.translatedText.length > 1024
    ? result.translatedText.slice(0, 1021) + '...'
    : result.translatedText;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**To: ${targetName}**\n${toText}`));

  const footerText = requestedBy ? `Requested by ${requestedBy}` : 'Nexus Translation';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerText}`));

  return container;
}

/**
 * Send a translated message using a webhook (preserves author name/avatar).
 */
export async function sendTranslatedWebhook(
  channel: TextChannel,
  message: Message,
  translatedText: string,
  targetLang: string,
): Promise<void> {
  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.name === 'Nexus Translate');

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Nexus Translate',
        reason: 'Auto-translation webhook',
      });
    }

    const langLabel = SUPPORTED_LANGUAGES[targetLang] || targetLang;

    await webhook.send({
      content: translatedText,
      username: `${message.author.displayName} (${langLabel})`,
      avatarURL: message.author.displayAvatarURL(),
      allowedMentions: { parse: [] }, // No pings from translations
    });
  } catch (err: any) {
    logger.error('Failed to send translated webhook', { error: err.message });
    // Fallback to V2 container reply
    const fallbackContainer = new ContainerBuilder().setAccentColor(0x4285F4);
    const authorText = `${message.author.displayName} (translated)`;
    fallbackContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${authorText}\n${translatedText}`));
    fallbackContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# → ${SUPPORTED_LANGUAGES[targetLang] || targetLang}`));

    await message.reply(v2Payload([fallbackContainer])).catch(() => {});
  }
}

/**
 * Validate that a language code is supported.
 */
export function isValidLanguage(code: string): boolean {
  return code in SUPPORTED_LANGUAGES;
}

/**
 * Get language name from code.
 */
export function getLanguageName(code: string): string {
  return SUPPORTED_LANGUAGES[code] || code;
}

/**
 * Find language code by name (case-insensitive partial match).
 */
export function findLanguageByName(query: string): Array<{ code: string; name: string }> {
  const lower = query.toLowerCase();
  return Object.entries(SUPPORTED_LANGUAGES)
    .filter(([code, name]) => name.toLowerCase().includes(lower) || code.toLowerCase() === lower)
    .map(([code, name]) => ({ code, name }))
    .slice(0, 25);
}
