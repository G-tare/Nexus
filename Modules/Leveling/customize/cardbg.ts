import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { successReply, errorReply, moduleContainer, addText, addFooter, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';

const validImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/**
 * Validates if a URL appears to be a direct image URL by extension.
 */
function hasImageExtension(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return validImageExtensions.some(ext => pathname.endsWith(`.${ext}`));
  } catch {
    return false;
  }
}

/**
 * Attempt to resolve a URL to a usable image link.
 * Strategy:
 *   1. If URL has a known image extension → use as-is after HEAD check
 *   2. HEAD request and check Content-Type for image/* → use as-is
 *   3. GET request and scrape og:image / meta image from HTML → use that URL
 * Returns the resolved image URL or null if nothing worked.
 */
async function resolveImageUrl(url: string): Promise<{ imageUrl: string | null; error?: string }> {
  try {
    new URL(url); // validate URL format
  } catch {
    return { imageUrl: null, error: 'Invalid URL format.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // Step 1 & 2: HEAD request to check Content-Type
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'NexusBot/1.0 (image-resolver)' },
    });

    if (!headRes.ok) {
      clearTimeout(timeout);
      return { imageUrl: null, error: `URL returned status ${headRes.status}.` };
    }

    const contentType = headRes.headers.get('content-type')?.toLowerCase() ?? '';

    // Direct image response — use as-is
    if (IMAGE_CONTENT_TYPES.some(ct => contentType.includes(ct))) {
      clearTimeout(timeout);
      return { imageUrl: url };
    }

    // If URL has image extension but Content-Type doesn't match, trust the extension
    // (some CDNs return generic content types)
    if (hasImageExtension(url)) {
      clearTimeout(timeout);
      return { imageUrl: url };
    }

    // Step 3: Not a direct image — try fetching HTML for og:image
    if (contentType.includes('text/html')) {
      clearTimeout(timeout);
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 8000);

      try {
        const getRes = await fetch(url, {
          method: 'GET',
          signal: getController.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'NexusBot/1.0 (image-resolver)' },
        });
        clearTimeout(getTimeout);

        if (!getRes.ok) {
          return { imageUrl: null, error: 'Could not fetch page to extract image.' };
        }

        // Read only first 50KB to avoid downloading huge pages
        const reader = getRes.body?.getReader();
        if (!reader) return { imageUrl: null, error: 'Could not read page content.' };

        let html = '';
        const decoder = new TextDecoder();
        let bytesRead = 0;
        const maxBytes = 50_000;

        while (bytesRead < maxBytes) {
          const { done, value } = await reader.read();
          if (done) break;
          html += decoder.decode(value, { stream: true });
          bytesRead += value.byteLength;
        }
        reader.cancel().catch(() => {});

        // Extract og:image or twitter:image
        const ogMatch = html.match(
          /<meta\s+(?:[^>]*?\s)?(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*?\scontent\s*=\s*["']([^"']+)["']/i
        ) ?? html.match(
          /<meta\s+(?:[^>]*?\s)?content\s*=\s*["']([^"']+)["'][^>]*?\s(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["']/i
        );

        if (ogMatch?.[1]) {
          let imageLink = ogMatch[1];
          // Resolve relative URLs
          if (imageLink.startsWith('/')) {
            const base = new URL(url);
            imageLink = `${base.protocol}//${base.host}${imageLink}`;
          }

          // Validate the extracted image URL is actually reachable
          try {
            const imgCheck = await fetch(imageLink, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (imgCheck.ok) {
              return { imageUrl: imageLink };
            }
          } catch {
            // Image URL from meta tag is not reachable
          }
        }

        return {
          imageUrl: null,
          error: 'This URL is a webpage but no image could be extracted from it. Try using a direct image link instead (right-click an image → Copy Image Address).',
        };
      } catch {
        clearTimeout(getTimeout);
        return { imageUrl: null, error: 'Timed out trying to extract image from the page.' };
      }
    }

    // Not an image and not HTML
    clearTimeout(timeout);
    return {
      imageUrl: null,
      error: 'This URL does not point to an image. Please use a direct image link (PNG, JPG, GIF, or WebP).',
    };
  } catch {
    clearTimeout(timeout);
    return { imageUrl: null, error: 'Unable to reach the URL. Please ensure it\'s a valid, public link.' };
  }
}

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.customize.cardbg',
  premiumFeature: 'leveling.advanced',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('cardbg')
    .setDescription('Set a custom background for your rank card')
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('Image URL for your rank card background')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('reset')
        .setDescription('Reset to default background')
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const url = interaction.options.getString('url');
      const reset = interaction.options.getBoolean('reset');

      const key = `cardbg:${guildId}:${userId}`;

      // Handle reset
      if (reset) {
        cache.del(key);
        return interaction.editReply(successReply('Background Reset', 'Your rank card background has been reset to default.'));
      }

      // Handle URL setting
      if (url) {
        // Resolve the URL — handles direct images, share links, og:image extraction
        const { imageUrl, error } = await resolveImageUrl(url);

        if (!imageUrl) {
          return interaction.editReply(errorReply(
            'Invalid Image',
            error || 'Could not resolve an image from that URL. Please use a direct image link.'
          ));
        }

        // Save the resolved URL to cache with 7-day expiry
        cache.set(key, imageUrl, 7 * 24 * 60 * 60);

        const description = imageUrl !== url
          ? 'Your rank card background has been saved.\nThe link was resolved to a direct image automatically.'
          : 'Your custom rank card background has been saved.';

        const container = moduleContainer('leveling');
        addText(container, `### ✅ Background Updated\n${description}`);
        // Note: V2 containers use addMediaGallery for images instead of inline embedding
        addMediaGallery(container, [{ url: imageUrl }]);
        addFooter(container, 'Your background will appear on your next rank card');

        return interaction.editReply(v2Payload([container]));
      }

      // No URL or reset provided
      return interaction.editReply(errorReply(
        'Missing Option',
        'Please provide either a `url` to set a background or use `reset` to restore the default.'
      ));
    } catch (error) {
      console.error('[CardBg Command Error]', error);
      return interaction.editReply(errorReply('Error', 'An error occurred while updating your card background.'));
    }
  }
};

export default command;
