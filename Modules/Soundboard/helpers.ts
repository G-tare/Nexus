import { getDb } from '../../Shared/src/database/connection';
import { soundboardSounds } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Soundboard:Helpers');

export const DEFAULT_SOUNDBOARD_CONFIG = {
  enabled: true,
  maxCustomSounds: 25,
  maxDuration: 10,
  allowUserUpload: true,
  embedColor: '#E67E22',
  cooldown: 5,
};

const DEFAULT_SOUNDS = [
  // Memes
  { name: 'airhorn', category: 'memes', url: 'https://cdn.discordapp.com/attachments/placeholder/airhorn.mp3', duration: 5 },
  { name: 'bruh', category: 'memes', url: 'https://cdn.discordapp.com/attachments/placeholder/bruh.mp3', duration: 3 },
  { name: 'sadviolin', category: 'memes', url: 'https://cdn.discordapp.com/attachments/placeholder/sadviolin.mp3', duration: 8 },
  { name: 'ohdamn', category: 'memes', url: 'https://cdn.discordapp.com/attachments/placeholder/ohdamn.mp3', duration: 2 },
  { name: 'suspense', category: 'memes', url: 'https://cdn.discordapp.com/attachments/placeholder/suspense.mp3', duration: 6 },
  // Windows
  { name: 'error', category: 'windows', url: 'https://cdn.discordapp.com/attachments/placeholder/error.mp3', duration: 2 },
  { name: 'shutdown', category: 'windows', url: 'https://cdn.discordapp.com/attachments/placeholder/shutdown.mp3', duration: 4 },
  { name: 'startup', category: 'windows', url: 'https://cdn.discordapp.com/attachments/placeholder/startup.mp3', duration: 3 },
  // Discord
  { name: 'call', category: 'discord', url: 'https://cdn.discordapp.com/attachments/placeholder/call.mp3', duration: 2 },
  { name: 'join', category: 'discord', url: 'https://cdn.discordapp.com/attachments/placeholder/join.mp3', duration: 1 },
  { name: 'leave', category: 'discord', url: 'https://cdn.discordapp.com/attachments/placeholder/leave.mp3', duration: 1 },
  { name: 'notification', category: 'discord', url: 'https://cdn.discordapp.com/attachments/placeholder/notification.mp3', duration: 1 },
  // Effects
  { name: 'drumroll', category: 'effects', url: 'https://cdn.discordapp.com/attachments/placeholder/drumroll.mp3', duration: 5 },
  { name: 'rimshot', category: 'effects', url: 'https://cdn.discordapp.com/attachments/placeholder/rimshot.mp3', duration: 1 },
  { name: 'crickets', category: 'effects', url: 'https://cdn.discordapp.com/attachments/placeholder/crickets.mp3', duration: 4 },
  { name: 'applause', category: 'effects', url: 'https://cdn.discordapp.com/attachments/placeholder/applause.mp3', duration: 6 },
  { name: 'boo', category: 'effects', url: 'https://cdn.discordapp.com/attachments/placeholder/boo.mp3', duration: 3 },
];

export async function getSoundboardConfig(guildId: string): Promise<Record<string, any>> {
  try {
    // Config would be stored in guildModuleConfigs with module='soundboard'
    return DEFAULT_SOUNDBOARD_CONFIG;
  } catch (error) {
    logger.error('Error getting soundboard config:', error);
    return DEFAULT_SOUNDBOARD_CONFIG;
  }
}

export async function getSound(guildId: string, name: string) {
  try {
    const db = await getDb();

    const result = await db
      .select()
      .from(soundboardSounds)
      .where(and(eq(soundboardSounds.guildId, guildId), eq(soundboardSounds.name, name.toLowerCase())))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    logger.error('Error getting sound:', error);
    return null;
  }
}

export async function getAllSounds(guildId: string) {
  try {
    const db = await getDb();

    const results = await db
      .select()
      .from(soundboardSounds)
      .where(eq(soundboardSounds.guildId, guildId));

    return results;
  } catch (error) {
    logger.error('Error getting all sounds:', error);
    return [];
  }
}

export async function addSound(
  guildId: string,
  name: string,
  category: string,
  url: string,
  duration: number,
  addedBy: string,
  isDefault: boolean = false
) {
  try {
    const db = await getDb();

    const result = await db
      .insert(soundboardSounds)
      .values({
        guildId,
        name: name.toLowerCase(),
        category,
        url,
        duration,
        addedBy,
        isDefault,
      })
      .returning();

    return result[0] || null;
  } catch (error) {
    logger.error('Error adding sound:', error);
    return null;
  }
}

export async function removeSound(guildId: string, name: string) {
  try {
    const db = await getDb();

    await db
      .delete(soundboardSounds)
      .where(and(eq(soundboardSounds.guildId, guildId), eq(soundboardSounds.name, name.toLowerCase())));

    return true;
  } catch (error) {
    logger.error('Error removing sound:', error);
    return false;
  }
}

export async function renameSound(guildId: string, oldName: string, newName: string) {
  try {
    const db = await getDb();

    const result = await db
      .update(soundboardSounds)
      .set({ name: newName.toLowerCase() })
      .where(and(eq(soundboardSounds.guildId, guildId), eq(soundboardSounds.name, oldName.toLowerCase())))
      .returning();

    return result[0] || null;
  } catch (error) {
    logger.error('Error renaming sound:', error);
    return null;
  }
}

export async function incrementUseCount(soundId: number) {
  try {
    const db = await getDb();

    const sound = await db.query.soundboardSounds.findFirst({
      where: (table) => eq(table.id, soundId),
    });

    if (sound) {
      await db
        .update(soundboardSounds)
        .set({ useCount: (sound.useCount || 0) + 1 })
        .where(eq(soundboardSounds.id, soundId));
    }

    return true;
  } catch (error) {
    logger.error('Error incrementing use count:', error);
    return false;
  }
}

export async function ensureDefaultSounds(guildId: string) {
  try {
    const db = await getDb();

    // Check if any default sounds exist
    const existing = await db
      .select()
      .from(soundboardSounds)
      .where(and(eq(soundboardSounds.guildId, guildId), eq(soundboardSounds.isDefault, true)))
      .limit(1);

    if (existing.length > 0) {
      return; // Already seeded
    }

    // Add default sounds
    for (const sound of DEFAULT_SOUNDS) {
      await db.insert(soundboardSounds).values({
        guildId,
        name: sound.name,
        category: sound.category,
        url: sound.url,
        duration: sound.duration,
        addedBy: 'system',
        isDefault: true,
      });
    }

    logger.info(`Seeded default sounds for guild ${guildId}`);
  } catch (error) {
    logger.error('Error seeding default sounds:', error);
  }
}

export function getSoundsByCategory(sounds: any[], category: string) {
  return sounds.filter(s => s.category === category);
}

export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    memes: '😂',
    windows: '🪟',
    discord: '💬',
    effects: '⚡',
  };
  return emojis[category] || '🔊';
}
