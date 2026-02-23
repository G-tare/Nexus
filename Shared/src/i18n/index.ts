import i18next from 'i18next';
import en from './locales/en.json';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('i18n');

// Initialize i18next
i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'moderation', 'leveling', 'currency', 'welcome', 'giveaway', 'tickets', 'confession', 'music', 'fun', 'reminders', 'afk', 'reputation'],
  resources: {
    en: {
      common: en.common,
      moderation: en.moderation,
      leveling: en.leveling,
      currency: en.currency,
      welcome: en.welcome,
      giveaway: en.giveaway,
      tickets: en.tickets,
      confession: en.confession,
      music: en.music,
      fun: en.fun,
      reminders: en.reminders,
      afk: en.afk,
      reputation: en.reputation,
    },
  },
  interpolation: {
    escapeValue: false, // Discord doesn't need HTML escaping
  },
});

/**
 * Translate a key with optional interpolation values.
 *
 * @param key - Translation key (e.g., "moderation:ban.success")
 * @param values - Interpolation values (e.g., { user: "John", case: 42 })
 * @param locale - Locale override (defaults to guild locale or 'en')
 */
export function t(key: string, values?: Record<string, any>, locale?: string): string {
  return i18next.t(key, { ...values, lng: locale || 'en' }) as string;
}

/**
 * Get a translator bound to a specific locale (for per-guild translations).
 */
export function getTranslator(locale: string = 'en') {
  return (key: string, values?: Record<string, any>) => t(key, values, locale);
}

/**
 * Add a new language resource bundle.
 * Call this to register new locale files at runtime.
 */
export function addLocale(locale: string, resources: Record<string, any>) {
  for (const [ns, translations] of Object.entries(resources)) {
    i18next.addResourceBundle(locale, ns, translations, true, true);
  }
  logger.info(`Added locale: ${locale}`);
}

export default i18next;
