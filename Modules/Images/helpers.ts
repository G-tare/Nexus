import { User } from 'discord.js';
import { getDb } from '../../Shared/src/database/connection';
import { guildModuleConfigs } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { ContainerBuilder } from 'discord.js';
import { moduleContainer, addText } from '../../Shared/src/utils/componentsV2';

export async function fetchImage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DiscordBot (Bot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (typeof data.url === 'string') {
      return data.url;
    }

    if (typeof data.image === 'string') {
      return data.image;
    }

    if (typeof data.link === 'string') {
      return data.link;
    }

    if (Array.isArray(data) && data.length > 0) {
      const first = data[0] as Record<string, unknown>;
      if (typeof first.url === 'string') {
        return first.url;
      }
      if (typeof first.image === 'string') {
        return first.image;
      }
    }

    throw new Error('Could not extract image URL from response');
  } catch (error) {
    throw new Error(`Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function buildImageEmbed(title: string, imageUrl: string, color: string = '#3498DB'): ContainerBuilder {
  const container = moduleContainer('images', false);
  addText(container, `### ${title}`);
  // Note: Images are set via the container's image property. This is a simplified approach.
  // For full image support, use addMediaGallery() or direct component structure
  return container;
}

export function getUserAvatarUrl(user: User, size: number = 512): string {
  return user.displayAvatarURL({ size, extension: 'png' });
}

export async function getImagesConfig(
  guildId: string
): Promise<{
  enabled: boolean;
  embedColor: string;
  cooldown: number;
  nsfwAllowed: boolean;
}> {
  const db = await getDb();
  const result = await db
    .select()
    .from(guildModuleConfigs)
    .where(and(eq(guildModuleConfigs.guildId, guildId), eq(guildModuleConfigs.module, 'images')))
    .limit(1);

  if (result.length === 0) {
    return {
      enabled: true,
      embedColor: '#3498DB',
      cooldown: 5,
      nsfwAllowed: false,
    };
  }

  const config = result[0].config as Record<string, unknown>;
  return {
    enabled: (config.enabled as boolean) ?? true,
    embedColor: (config.embedColor as string) ?? '#3498DB',
    cooldown: (config.cooldown as number) ?? 5,
    nsfwAllowed: (config.nsfwAllowed as boolean) ?? false,
  };
}
