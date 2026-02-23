import { EmbedBuilder } from 'discord.js';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { users, guildMembers, guilds } from '../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { eventBus } from '../../Shared/src/events/eventBus';

// ============================================
// Types
// ============================================

export interface BirthdayConfig {
  enabled: boolean;
  channelId?: string;
  roleId?: string;
  announcementMessage: string;
  timezone: string;
  dmNotification: boolean;
  showAge: boolean;
  allowHideYear: boolean;
}

export interface BirthdayEntry {
  userId: string;
  birthday: string; // MM-DD
  birthdayYear?: number | null;
  hideYear: boolean;
  username?: string;
  globalName?: string;
}

const DEFAULT_CONFIG: BirthdayConfig = {
  enabled: true,
  channelId: undefined,
  roleId: undefined,
  announcementMessage: '🎂 Happy Birthday {user}! 🎉',
  timezone: 'UTC',
  dmNotification: true,
  showAge: true,
  allowHideYear: true,
};

// ============================================
// Config Helpers
// ============================================

export async function getBirthdayConfig(guildId: string): Promise<BirthdayConfig> {
  const redis = getRedis();
  const cached = await redis.get(`birthday:config:${guildId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const _storedCfgResult = await moduleConfig.getModuleConfig(guildId, 'birthdays');
  const _storedCfg = (_storedCfgResult?.config ?? {}) as Record<string, any>;
  const stored = (_storedCfg?.config ?? {}) as any;
  const config = { ...DEFAULT_CONFIG, ...stored };

  await redis.set(`birthday:config:${guildId}`, JSON.stringify(config), 'EX', 300);
  return config;
}

export async function setBirthdayConfig(guildId: string, updates: Partial<BirthdayConfig>): Promise<BirthdayConfig> {
  const redis = getRedis();
  const current = await getBirthdayConfig(guildId);
  const updated = { ...current, ...updates };

  await moduleConfig.setConfig(guildId, 'birthdays', updated);
  await redis.set(`birthday:config:${guildId}`, JSON.stringify(updated), 'EX', 300);

  eventBus.emit('auditLog', {
    guildId,
    type: 'BIRTHDAY_CONFIG_UPDATED',
    data: { updates },
  });

  return updated;
}

// ============================================
// Birthday CRUD
// ============================================

export async function setBirthday(
  userId: string,
  month: number,
  day: number,
  year?: number
): Promise<void> {
  const db = getDb();
  const redis = getRedis();
  const birthday = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  await db
    .update(users)
    .set({
      birthday,
      birthdayYear: year ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Invalidate cache
  await redis.del(`birthday:user:${userId}`);
}

export async function removeBirthday(userId: string): Promise<void> {
  const db = getDb();
  const redis = getRedis();
  await db
    .update(users)
    .set({
      birthday: null,
      birthdayYear: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await redis.del(`birthday:user:${userId}`);
}

export async function getBirthday(userId: string): Promise<BirthdayEntry | null> {
  const db = getDb();
  const redis = getRedis();
  const cached = await redis.get(`birthday:user:${userId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  const result = await db
    .select({
      userId: users.id,
      birthday: users.birthday,
      birthdayYear: users.birthdayYear,
      username: users.username,
      globalName: users.globalName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!result.length || !result[0].birthday) {
    return null;
  }

  const entry: BirthdayEntry = {
    userId: result[0].userId,
    birthday: result[0].birthday,
    birthdayYear: result[0].birthdayYear,
    hideYear: false, // Will be checked per-guild
    username: result[0].username ?? undefined,
    globalName: result[0].globalName ?? undefined,
  };

  await redis.set(`birthday:user:${userId}`, JSON.stringify(entry), 'EX', 600);
  return entry;
}

/**
 * Get all birthdays for today (MM-DD) across members of a guild.
 */
export async function getTodaysBirthdays(guildId: string): Promise<BirthdayEntry[]> {
  const db = getDb();
  const config = await getBirthdayConfig(guildId);

  // Get today's date in the guild's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const todayStr = `${month}-${day}`;

  const results = await db
    .select({
      userId: users.id,
      birthday: users.birthday,
      birthdayYear: users.birthdayYear,
      username: users.username,
      globalName: users.globalName,
    })
    .from(users)
    .innerJoin(guildMembers, eq(users.id, guildMembers.userId))
    .where(
      and(
        eq(guildMembers.guildId, guildId),
        eq(users.birthday, todayStr)
      )
    );

  return results
    .filter((r) => r.birthday !== null)
    .map((r) => ({
      userId: r.userId,
      birthday: r.birthday!,
      birthdayYear: r.birthdayYear,
      hideYear: false,
      username: r.username ?? undefined,
      globalName: r.globalName ?? undefined,
    }));
}

/**
 * Get upcoming birthdays for a guild within the next N days.
 */
export async function getUpcomingBirthdays(guildId: string, days: number = 30): Promise<BirthdayEntry[]> {
  const db = getDb();
  const config = await getBirthdayConfig(guildId);

  // Get all guild members with birthdays
  const results = await db
    .select({
      userId: users.id,
      birthday: users.birthday,
      birthdayYear: users.birthdayYear,
      username: users.username,
      globalName: users.globalName,
    })
    .from(users)
    .innerJoin(guildMembers, eq(users.id, guildMembers.userId))
    .where(
      and(
        eq(guildMembers.guildId, guildId),
        sql`${users.birthday} IS NOT NULL`
      )
    );

  // Filter to upcoming N days
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const nowParts = formatter.formatToParts(now);
  const currentMonth = parseInt(nowParts.find((p) => p.type === 'month')?.value || '1');
  const currentDay = parseInt(nowParts.find((p) => p.type === 'day')?.value || '1');
  const currentYear = parseInt(nowParts.find((p) => p.type === 'year')?.value || '2026');

  const todayDate = new Date(currentYear, currentMonth - 1, currentDay);

  const upcoming = results
    .filter((r) => r.birthday !== null)
    .map((r) => {
      const [mm, dd] = r.birthday!.split('-').map(Number);
      let nextBirthday = new Date(currentYear, mm - 1, dd);

      // If birthday already passed this year, use next year
      if (nextBirthday < todayDate) {
        nextBirthday = new Date(currentYear + 1, mm - 1, dd);
      }

      const daysUntil = Math.ceil(
        (nextBirthday.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        entry: {
          userId: r.userId,
          birthday: r.birthday!,
          birthdayYear: r.birthdayYear,
          hideYear: false,
          username: r.username ?? undefined,
          globalName: r.globalName ?? undefined,
        },
        daysUntil,
      };
    })
    .filter((item) => item.daysUntil <= days && item.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return upcoming.map((item) => item.entry);
}

/**
 * Get all birthdays for a specific month.
 */
export async function getBirthdaysInMonth(guildId: string, month: number): Promise<BirthdayEntry[]> {
  const db = getDb();
  const monthStr = String(month).padStart(2, '0');

  const results = await db
    .select({
      userId: users.id,
      birthday: users.birthday,
      birthdayYear: users.birthdayYear,
      username: users.username,
      globalName: users.globalName,
    })
    .from(users)
    .innerJoin(guildMembers, eq(users.id, guildMembers.userId))
    .where(
      and(
        eq(guildMembers.guildId, guildId),
        sql`${users.birthday} LIKE ${monthStr + '-%'}`
      )
    );

  return results
    .filter((r) => r.birthday !== null)
    .map((r) => ({
      userId: r.userId,
      birthday: r.birthday!,
      birthdayYear: r.birthdayYear,
      hideYear: false,
      username: r.username ?? undefined,
      globalName: r.globalName ?? undefined,
    }))
    .sort((a, b) => {
      const dayA = parseInt(a.birthday.split('-')[1]);
      const dayB = parseInt(b.birthday.split('-')[1]);
      return dayA - dayB;
    });
}

// ============================================
// Date Validation
// ============================================

export function isValidDate(month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function getAge(birthdayYear: number, birthdayMD: string): number | null {
  if (!birthdayYear) return null;

  const [mm, dd] = birthdayMD.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - birthdayYear;

  // Hasn't had birthday this year yet
  if (
    now.getMonth() + 1 < mm ||
    (now.getMonth() + 1 === mm && now.getDate() < dd)
  ) {
    age--;
  }

  return age;
}

export function formatBirthday(birthday: string, birthdayYear?: number | null, showAge: boolean = true): string {
  const [mm, dd] = birthday.split('-');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[parseInt(mm) - 1];
  const dayNum = parseInt(dd);

  let suffix = 'th';
  if (dayNum === 1 || dayNum === 21 || dayNum === 31) suffix = 'st';
  else if (dayNum === 2 || dayNum === 22) suffix = 'nd';
  else if (dayNum === 3 || dayNum === 23) suffix = 'rd';

  let str = `${monthName} ${dayNum}${suffix}`;

  if (birthdayYear && showAge) {
    const age = getAge(birthdayYear, birthday);
    if (age !== null) {
      str += ` (Age: ${age})`;
    }
  }

  return str;
}

// ============================================
// Announcement Helpers
// ============================================

export function parseAnnouncementMessage(
  template: string,
  userId: string,
  username: string,
  age?: number | null
): string {
  return template
    .replace(/\{user\}/g, `<@${userId}>`)
    .replace(/\{username\}/g, username)
    .replace(/\{age\}/g, age ? String(age) : '???')
    .replace(/\{server\}/g, '{server}'); // Replaced at send time with guild name
}

export function buildBirthdayAnnouncementEmbed(
  userId: string,
  username: string,
  message: string,
  age?: number | null,
  showAge: boolean = true
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#FF69B4')
    .setTitle('🎂 Happy Birthday!')
    .setDescription(message)
    .setThumbnail(`https://cdn.discordapp.com/embed/avatars/0.png`) // Placeholder, replaced with user avatar at send time
    .setTimestamp();

  if (age && showAge) {
    embed.addFields({
      name: '🎈 Turning',
      value: `${age} years old!`,
      inline: true,
    });
  }

  return embed;
}

export function buildBirthdayViewEmbed(entry: BirthdayEntry, showAge: boolean): EmbedBuilder {
  const displayName = entry.globalName || entry.username || 'Unknown';
  const formattedDate = formatBirthday(entry.birthday, showAge ? entry.birthdayYear : null, showAge);

  const embed = new EmbedBuilder()
    .setColor('#FF69B4')
    .setTitle(`🎂 ${displayName}'s Birthday`)
    .addFields({
      name: 'Date',
      value: formattedDate,
      inline: true,
    })
    .setTimestamp();

  // Days until next birthday
  const [mm, dd] = entry.birthday.split('-').map(Number);
  const now = new Date();
  let nextBirthday = new Date(now.getFullYear(), mm - 1, dd);
  if (nextBirthday <= now) {
    nextBirthday = new Date(now.getFullYear() + 1, mm - 1, dd);
  }
  const daysUntil = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil === 0) {
    embed.addFields({ name: '🎉', value: "It's their birthday today!", inline: true });
  } else {
    embed.addFields({ name: 'Days Until', value: `${daysUntil} days`, inline: true });
  }

  return embed;
}

export function buildUpcomingEmbed(entries: BirthdayEntry[], title: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#FF69B4')
    .setTitle(title)
    .setTimestamp();

  if (entries.length === 0) {
    embed.setDescription('No upcoming birthdays found.');
    return embed;
  }

  const now = new Date();
  const lines = entries.slice(0, 20).map((entry) => {
    const [mm, dd] = entry.birthday.split('-').map(Number);
    let nextBirthday = new Date(now.getFullYear(), mm - 1, dd);
    if (nextBirthday < now) {
      nextBirthday = new Date(now.getFullYear() + 1, mm - 1, dd);
    }
    const daysUntil = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const dayLabel = daysUntil === 0 ? '**TODAY!** 🎉' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;

    return `<@${entry.userId}> — ${formatBirthday(entry.birthday, null, false)} (${dayLabel})`;
  });

  embed.setDescription(lines.join('\n'));

  if (entries.length > 20) {
    embed.setFooter({ text: `Showing 20 of ${entries.length} birthdays` });
  }

  return embed;
}

// ============================================
// Redis Tracking for Daily Check
// ============================================

/**
 * Mark that a birthday has been announced today so we don't double-announce.
 */
export async function markBirthdayAnnounced(guildId: string, userId: string): Promise<void> {
  const redis = getRedis();
  const key = `birthday:announced:${guildId}:${userId}`;
  await redis.set(key, '1', 'EX', 86400); // Expires in 24 hours
}

export async function wasBirthdayAnnounced(guildId: string, userId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `birthday:announced:${guildId}:${userId}`;
  return (await redis.get(key)) === '1';
}

/**
 * Track birthday role assignment for auto-removal after 24h.
 */
export async function trackBirthdayRole(guildId: string, userId: string): Promise<void> {
  const redis = getRedis();
  const key = `birthday:role:${guildId}`;
  await redis.sadd(key, userId);
  await redis.expire(key, 90000); // 25 hours buffer
}

export async function getBirthdayRoleUsers(guildId: string): Promise<string[]> {
  const redis = getRedis();
  return await redis.smembers(`birthday:role:${guildId}`);
}

export async function removeBirthdayRoleTracking(guildId: string, userId: string): Promise<void> {
  const redis = getRedis();
  await redis.srem(`birthday:role:${guildId}`, userId);
}
