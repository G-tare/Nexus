import { getDb } from '../../Shared/src/database/connection';
import { profiles, guildModuleConfigs } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';

export interface ProfileRecord {
  id: number;
  guildId: string;
  userId: string;
  aboutMe: string | null;
  age: number | null;
  gender: string | null;
  location: string | null;
  status: string | null;
  birthday: string | null;
  profileColor: string | null;
  bannerUrl: string | null;
  favoriteActors: unknown[];
  favoriteArtists: unknown[];
  favoriteFoods: unknown[];
  hobbies: unknown[];
  favoriteMovies: unknown[];
  pets: unknown[];
  favoriteSongs: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getProfile(guildId: string, userId: string): Promise<ProfileRecord | null> {
  const db = await getDb();
  const result = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.guildId, guildId), eq(profiles.userId, userId)))
    .limit(1);

  return result.length > 0 ? (result[0] as ProfileRecord) : null;
}

export async function createProfile(
  guildId: string,
  userId: string,
  data: Partial<ProfileRecord>
): Promise<ProfileRecord> {
  const db = await getDb();
  const result = await db
    .insert(profiles)
    .values({
      guildId,
      userId,
      aboutMe: data.aboutMe || null,
      age: data.age || null,
      gender: data.gender || null,
      location: data.location || null,
      status: data.status || null,
      birthday: data.birthday || null,
      profileColor: data.profileColor || null,
      bannerUrl: data.bannerUrl || null,
      favoriteActors: data.favoriteActors || [],
      favoriteArtists: data.favoriteArtists || [],
      favoriteFoods: data.favoriteFoods || [],
      hobbies: data.hobbies || [],
      favoriteMovies: data.favoriteMovies || [],
      pets: data.pets || [],
      favoriteSongs: data.favoriteSongs || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return result[0] as ProfileRecord;
}

export async function updateProfile(
  guildId: string,
  userId: string,
  field: keyof Omit<ProfileRecord, 'id' | 'guildId' | 'userId' | 'createdAt' | 'updatedAt'>,
  value: unknown
): Promise<ProfileRecord | null> {
  const db = await getDb();
  const result = await db
    .update(profiles)
    .set({
      [field]: value,
      updatedAt: new Date(),
    })
    .where(and(eq(profiles.guildId, guildId), eq(profiles.userId, userId)))
    .returning();

  return result.length > 0 ? (result[0] as ProfileRecord) : null;
}

export async function deleteProfile(guildId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(profiles)
    .where(and(eq(profiles.guildId, guildId), eq(profiles.userId, userId)));

  return true;
}

export async function addToList(
  guildId: string,
  userId: string,
  listName: 'favoriteActors' | 'favoriteArtists' | 'favoriteFoods' | 'hobbies' | 'favoriteMovies' | 'pets' | 'favoriteSongs',
  item: string,
  maxItems: number = 10
): Promise<ProfileRecord | null> {
  const profile = await getProfile(guildId, userId);
  if (!profile) return null;

  const list = (profile[listName] as string[]) || [];
  if (list.includes(item)) return profile;
  if (list.length >= maxItems) return null;

  const updated = await updateProfile(guildId, userId, listName, [...list, item]);
  return updated;
}

export async function removeFromList(
  guildId: string,
  userId: string,
  listName: 'favoriteActors' | 'favoriteArtists' | 'favoriteFoods' | 'hobbies' | 'favoriteMovies' | 'pets' | 'favoriteSongs',
  item: string
): Promise<ProfileRecord | null> {
  const profile = await getProfile(guildId, userId);
  if (!profile) return null;

  const list = (profile[listName] as string[]) || [];
  const filtered = list.filter((i) => i !== item);

  const updated = await updateProfile(guildId, userId, listName, filtered);
  return updated;
}

export async function getProfileConfig(
  guildId: string
): Promise<{
  enabled: boolean;
  maxListItems: number;
  requireCreate: boolean;
  embedColor: string;
}> {
  const db = await getDb();
  const result = await db
    .select()
    .from(guildModuleConfigs)
    .where(and(eq(guildModuleConfigs.guildId, guildId), eq(guildModuleConfigs.module, 'profile')))
    .limit(1);

  if (result.length === 0) {
    return {
      enabled: true,
      maxListItems: 10,
      requireCreate: true,
      embedColor: '#9B59B6',
    };
  }

  const config = result[0].config as Record<string, unknown>;
  return {
    enabled: (config.enabled as boolean) ?? true,
    maxListItems: (config.maxListItems as number) ?? 10,
    requireCreate: (config.requireCreate as boolean) ?? true,
    embedColor: (config.embedColor as string) ?? '#9B59B6',
  };
}
