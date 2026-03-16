import { cache } from '../../../Shared/src/cache/cacheManager';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Fun.GifProvider');

// Fallback GIF URLs for each interaction type
const GIF_FALLBACKS: Record<string, string[]> = {
  hug: [
    'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlNaQ9GB3F2/giphy.gif',
    'https://media.giphy.com/media/3ohjV4rHd7k8W5bIGQ/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
  ],
  pat: [
    'https://media.giphy.com/media/3o7TKU0bNtBKOjAJ8k/giphy.gif',
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  slap: [
    'https://media.giphy.com/media/l3q2K5jinAlZ37wa8/giphy.gif',
    'https://media.giphy.com/media/l0HlFZ3c4tD2QTKwg/giphy.gif',
    'https://media.giphy.com/media/3o6Zt0YNwpPbM8n5rO/giphy.gif',
    'https://media.giphy.com/media/l0HlDtKPoYJhTiTwQ/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  ],
  kiss: [
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o7TKozI0mRXm2L7Bi/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0HlHZWFn7Bq79YAI/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
  ],
  cuddle: [
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlF2L9D3b1aU2wo/giphy.gif',
    'https://media.giphy.com/media/3o7TKozI0mRXm2L7Bi/giphy.gif',
  ],
  poke: [
    'https://media.giphy.com/media/l0HlOY9x8FZo0XO1i/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif',
    'https://media.giphy.com/media/l0HlDtKPoYJhTiTwQ/giphy.gif',
  ],
  bite: [
    'https://media.giphy.com/media/l0HlUWsjzfHJQX3kQ/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  punch: [
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlHZWFn7Bq79YAI/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlDtKPoYJhTiTwQ/giphy.gif',
    'https://media.giphy.com/media/3o7TKozI0mRXm2L7Bi/giphy.gif',
  ],
  kick: [
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif',
    'https://media.giphy.com/media/l0HlHZWFn7Bq79YAI/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  cry: [
    'https://media.giphy.com/media/l0HlNaQ9GB3F2/giphy.gif',
    'https://media.giphy.com/media/3o7TKU0bNtBKOjAJ8k/giphy.gif',
    'https://media.giphy.com/media/l0HlFZ3c4tD2QTKwg/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  ],
  laugh: [
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/l0HlOY9x8FZo0XO1i/giphy.gif',
  ],
  dance: [
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlFZ3c4tD2QTKwg/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  wave: [
    'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  boop: [
    'https://media.giphy.com/media/l0HlOY9x8FZo0XO1i/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6ZtpWzLwMEymzk4w/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
  pout: [
    'https://media.giphy.com/media/l0HlFZ3c4tD2QTKwg/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
  ],
  highfive: [
    'https://media.giphy.com/media/3o6ZsYq8d0pgwpAp2E/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/l0HlR134msLkIWgZ2/giphy.gif',
    'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif',
    'https://media.giphy.com/media/l0HlAXiP3VUFGuvEk/giphy.gif',
  ],
};

/**
 * Get a random interaction GIF
 * Tries nekos.life API first, falls back to hardcoded URLs
 */
export async function getInteractionGif(type: string): Promise<string> {
  try {
    const cacheKey = `fun:gif:${type}`;

    // Try to get from cache
    const cached = cache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try nekos.life API
    try {
      const response = await fetch(`https://nekos.life/api/v2/img/${type}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          // Cache for 1 hour
          cache.set(cacheKey, data.url, 3600);
          return data.url;
        }
      }
    } catch (apiError) {
      logger.debug(`nekos.life API call failed for ${type}, using fallback`);
    }

    // Use fallback
    const fallbacks = GIF_FALLBACKS[type] || GIF_FALLBACKS.hug;
    const gif = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    cache.set(cacheKey, gif, 3600);
    return gif;
  } catch (error) {
    logger.error(`Error getting interaction GIF for ${type}`, error);
    const fallbacks = GIF_FALLBACKS[type] || GIF_FALLBACKS.hug;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
