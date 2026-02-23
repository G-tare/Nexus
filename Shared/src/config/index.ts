import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const config = {
  // Discord
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    clientSecret: required('DISCORD_CLIENT_SECRET'),
    ownerIds: required('OWNER_IDS').split(',').map(id => id.trim()),
  },

  // Database
  database: {
    url: required('DATABASE_URL'),
    redis: required('REDIS_URL'),
  },

  // API
  api: {
    port: parseInt(optional('API_PORT', '3001'), 10),
    jwtSecret: required('JWT_SECRET'),
    dashboardUrl: optional('DASHBOARD_URL', 'http://localhost:3000'),
    apiUrl: optional('API_URL', 'http://localhost:3001'),
  },

  // Lavalink
  lavalink: {
    host: optional('LAVALINK_HOST', 'localhost'),
    port: parseInt(optional('LAVALINK_PORT', '2333'), 10),
    password: optional('LAVALINK_PASSWORD', 'youshallnotpass'),
  },

  // AI
  ai: {
    defaultProvider: optional('DEFAULT_AI_PROVIDER', 'grok'),
    defaultApiKey: optional('DEFAULT_AI_API_KEY'),
  },

  // Premium
  premium: {
    enabled: optional('PREMIUM_ENABLED', 'false') === 'true',
    stripeSecretKey: optional('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  },

  // External
  external: {
    translationApiKey: optional('TRANSLATION_API_KEY'),
    imgurClientId: optional('IMGUR_CLIENT_ID'),
  },

  // Logging
  logging: {
    level: optional('LOG_LEVEL', 'info'),
  },

  // Environment
  env: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',
} as const;

export type Config = typeof config;
