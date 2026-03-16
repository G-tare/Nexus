import {
  Guild, GuildMember, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, TextChannel, ContainerBuilder,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { cache } from '../../Shared/src/cache/cacheManager';
import { getDb } from '../../Shared/src/database/connection';
import { giveaways, giveawayEntries, guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  moduleContainer, addText, addFields, addSeparator, v2Payload, addButtons
} from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Giveaways');

// ============================================================================
// INTERFACES
// ============================================================================

export interface GiveawayRequirement {
  type: 'role' | 'level' | 'messages' | 'invites';
  value: string | number;
}

export interface GiveawayConfig {
  enabled: boolean;
  defaultChannelId?: string;
  emoji: string;
  useButtons: boolean;
  dmWinners: boolean;
  pingRoleId?: string;
  defaultColor: string;
  endAction: 'edit' | 'delete';
  maxActivePerGuild: number;
  allowSelfEntry: boolean;
}

export interface GiveawayData {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  prize: string;
  winnerCount: number;
  endsAt: Date;
  startsAt: Date;
  isActive: boolean;
  endedAt: Date | null;
  winners: string[];
  requirements: any;
  entryCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_GIVEAWAY_CONFIG: GiveawayConfig = {
  enabled: false,
  emoji: '🎉',
  useButtons: true,
  dmWinners: true,
  defaultColor: '#FF7F50',
  endAction: 'edit',
  maxActivePerGuild: 20,
  allowSelfEntry: false,
};

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

export async function getGiveawayConfig(guildId: string): Promise<GiveawayConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'giveaways');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...DEFAULT_GIVEAWAY_CONFIG, ...config };
  } catch (error) {
    logger.error(`Failed to get giveaway config for guild ${guildId}:`, error);
    return { ...DEFAULT_GIVEAWAY_CONFIG };
  }
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

export async function createGiveaway(data: Partial<GiveawayData>): Promise<GiveawayData> {
  const db = getDb();
  const rows = await db.insert(giveaways).values({
    guildId: data.guildId!,
    channelId: data.channelId!,
    messageId: data.messageId || null,
    hostId: data.hostId!,
    prize: data.prize!,
    winnerCount: data.winnerCount || 1,
    endsAt: data.endsAt!,
    requirements: data.requirements || {},
    winners: data.winners || [],
    isActive: true,
  }).returning();

  const row = rows[0];
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    messageId: row.messageId,
    hostId: row.hostId,
    prize: row.prize,
    winnerCount: row.winnerCount,
    endsAt: row.endsAt,
    startsAt: row.startsAt,
    isActive: row.isActive,
    endedAt: row.endedAt,
    winners: (row.winners as string[]) || [],
    requirements: row.requirements || {},
    entryCount: 0,
  };
}

export async function getGiveaway(giveawayId: number): Promise<GiveawayData | null> {
  const db = getDb();
  const result = await db.select().from(giveaways).where(eq(giveaways.id, giveawayId)).limit(1);
  if (!result.length) return null;
  const row = result[0];
  const entryCount = await getEntryCount(giveawayId);
  return {
    id: row.id, guildId: row.guildId, channelId: row.channelId,
    messageId: row.messageId, hostId: row.hostId, prize: row.prize,
    winnerCount: row.winnerCount, endsAt: row.endsAt, startsAt: row.startsAt,
    isActive: row.isActive, endedAt: row.endedAt,
    winners: (row.winners as string[]) || [],
    requirements: row.requirements || {},
    entryCount,
  };
}

export async function getGiveawayByMessage(messageId: string): Promise<GiveawayData | null> {
  const db = getDb();
  const result = await db.select().from(giveaways).where(eq(giveaways.messageId!, messageId)).limit(1);
  if (!result.length) return null;
  return getGiveaway(result[0].id);
}

export async function getActiveGiveaways(guildId: string): Promise<GiveawayData[]> {
  const db = getDb();
  const results = await db.select().from(giveaways)
    .where(and(eq(giveaways.guildId, guildId), eq(giveaways.isActive, true)))
    .orderBy(desc(giveaways.startsAt));

  const list: GiveawayData[] = [];
  for (const row of results) {
    const entryCount = await getEntryCount(row.id);
    list.push({
      id: row.id, guildId: row.guildId, channelId: row.channelId,
      messageId: row.messageId, hostId: row.hostId, prize: row.prize,
      winnerCount: row.winnerCount, endsAt: row.endsAt, startsAt: row.startsAt,
      isActive: row.isActive, endedAt: row.endedAt,
      winners: (row.winners as string[]) || [],
      requirements: row.requirements || {},
      entryCount,
    });
  }
  return list;
}

// ============================================================================
// ENTRY MANAGEMENT
// ============================================================================

export async function enterGiveaway(giveawayId: number, userId: string): Promise<{ success: boolean; reason?: string }> {
  const db = getDb();
  const giveaway = await getGiveaway(giveawayId);
  if (!giveaway) return { success: false, reason: 'Giveaway not found' };

  const existing = await db.select().from(giveawayEntries)
    .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)))
    .limit(1);
  if (existing.length) return { success: false, reason: 'Already entered' };

  const config = await getGiveawayConfig(giveaway.guildId);
  if (!config.allowSelfEntry && giveaway.hostId === userId) {
    return { success: false, reason: 'Cannot enter your own giveaway' };
  }

  try {
    await db.insert(giveawayEntries).values({ giveawayId, userId });
    await cache.incr(`giveaway:${giveawayId}:entries`);
    return { success: true };
  } catch (error) {
    logger.error(`Failed to enter giveaway ${giveawayId}:`, error);
    return { success: false, reason: 'Failed to enter giveaway' };
  }
}

export async function getEntryCount(giveawayId: number): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(giveawayEntries)
    .where(eq(giveawayEntries.giveawayId, giveawayId));
  return result[0]?.count || 0;
}

// ============================================================================
// REQUIREMENT CHECKING
// ============================================================================

export async function checkRequirements(
  member: GuildMember, requirements: GiveawayRequirement[]
): Promise<{ met: boolean; failed?: string }> {
  const db = getDb();
  for (const req of requirements) {
    if (req.type === 'role') {
      if (!member.roles.cache.has(req.value as string)) {
        const role = member.guild.roles.cache.get(req.value as string);
        return { met: false, failed: `Missing role: ${role?.name || 'Unknown'}` };
      }
    }
    if (req.type === 'level' || req.type === 'messages' || req.type === 'invites') {
      const record = await db.select().from(guildMembers)
        .where(and(eq(guildMembers.userId, member.id), eq(guildMembers.guildId, member.guild.id)))
        .limit(1);
      const row = record[0] as any;
      if (req.type === 'level' && (row?.level || 0) < (req.value as number)) {
        return { met: false, failed: `Level ${row?.level || 0} < required ${req.value}` };
      }
      if (req.type === 'messages' && (row?.totalMessages || 0) < (req.value as number)) {
        return { met: false, failed: `Messages ${row?.totalMessages || 0} < required ${req.value}` };
      }
      if (req.type === 'invites' && (row?.inviteCount || 0) < (req.value as number)) {
        return { met: false, failed: `Invites ${row?.inviteCount || 0} < required ${req.value}` };
      }
    }
  }
  return { met: true };
}

export async function calculateEntries(
  giveawayId: number, userId: string, member: GuildMember
): Promise<number> {
  const giveaway = await getGiveaway(giveawayId);
  if (!giveaway) return 1;
  const reqs = giveaway.requirements as any;
  const bonusEntries = reqs?.bonusEntries || {};
  let total = 1;
  if (bonusEntries[userId]) total += bonusEntries[userId];
  for (const [key, bonus] of Object.entries(bonusEntries)) {
    if (member.roles.cache.has(key)) total += bonus as number;
  }
  return total;
}

// ============================================================================
// WINNER SELECTION
// ============================================================================

export async function pickWinners(giveawayId: number, count: number): Promise<string[]> {
  const db = getDb();
  const entries = await db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
  if (!entries.length) return [];
  const shuffled = entries.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((e) => e.userId);
}

export async function endGiveaway(giveaway: GiveawayData, guild: Guild): Promise<string[]> {
  const db = getDb();
  const config = await getGiveawayConfig(guild.id);
  const winners = await pickWinners(giveaway.id, giveaway.winnerCount);

  await db.update(giveaways).set({ isActive: false, endedAt: new Date(), winners }).where(eq(giveaways.id, giveaway.id));

  try {
    const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
    if (channel && giveaway.messageId) {
      const message = await channel.messages.fetch(giveaway.messageId);
      if (message) {
        const endedContainer = buildGiveawayEndedContainer(giveaway, winners);
        if (config.endAction === 'edit') {
          await message.edit(v2Payload([endedContainer]));
        } else {
          await message.delete();
        }
      }
    }
  } catch (error) {
    logger.warn(`Failed to edit giveaway message: ${error}`);
  }

  if (config.dmWinners && winners.length > 0) {
    for (const winnerId of winners) {
      try {
        const user = await guild.client.users.fetch(winnerId);
        await user.send(`Congratulations! You won **${giveaway.prize}** in ${guild.name}!`);
      } catch (error) {
        logger.warn(`Failed to DM winner ${winnerId}: ${error}`);
      }
    }
  }

  return winners;
}

export async function rerollGiveaway(giveaway: GiveawayData, guild: Guild, count?: number): Promise<string[]> {
  const db = getDb();
  const config = await getGiveawayConfig(guild.id);
  const winnerCount = count || giveaway.winnerCount;

  const entries = await db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveaway.id));
  const validEntries = entries.filter((e) => !giveaway.winners.includes(e.userId));
  if (!validEntries.length) return [];

  const shuffled = validEntries.sort(() => Math.random() - 0.5);
  const newWinners = shuffled.slice(0, Math.min(winnerCount, shuffled.length)).map((e) => e.userId);
  const updatedWinners = [...giveaway.winners, ...newWinners];

  await db.update(giveaways).set({ winners: updatedWinners }).where(eq(giveaways.id, giveaway.id));

  try {
    const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel;
    if (channel && giveaway.messageId) {
      const message = await channel.messages.fetch(giveaway.messageId);
      if (message) {
        const endedContainer = buildGiveawayEndedContainer(giveaway, updatedWinners);
        await message.edit(v2Payload([endedContainer]));
      }
    }
  } catch (error) {
    logger.warn(`Failed to edit rerolled giveaway: ${error}`);
  }

  if (config.dmWinners && newWinners.length > 0) {
    for (const winnerId of newWinners) {
      try {
        const user = await guild.client.users.fetch(winnerId);
        await user.send(`Congratulations! You won **${giveaway.prize}** in ${guild.name}! (Reroll)`);
      } catch (error) { logger.warn(`Failed to DM reroll winner: ${error}`); }
    }
  }

  return newWinners;
}

// ============================================================================
// EMBED BUILDERS
// ============================================================================

export function buildGiveawayContainer(giveaway: GiveawayData, config: GiveawayConfig): ContainerBuilder {
  const container = moduleContainer('giveaways');
  addText(container, `### ${giveaway.prize}`);
  addSeparator(container, 'small');
  addFields(container, [
    { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
    { name: 'Winners', value: `${giveaway.winnerCount}`, inline: true },
    { name: 'Entries', value: `${giveaway.entryCount}`, inline: true },
    { name: 'Ends', value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`, inline: false },
  ]);
  addText(container, `-# Giveaway ID: ${giveaway.id}`);
  return container;
}

export function buildGiveawayEndedContainer(giveaway: GiveawayData, winners: string[]): ContainerBuilder {
  const container = moduleContainer('giveaways');
  addText(container, `### ${giveaway.prize}`);
  addSeparator(container, 'small');
  addFields(container, [
    { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
    { name: 'Ended', value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`, inline: true },
    { name: 'Winner(s)', value: winners.length ? winners.map((w) => `<@${w}>`).join('\n') : 'No valid entries', inline: false },
  ]);
  return container;
}

export function buildDropContainer(prize: string, maxWinners: number, currentWinners: string[]): ContainerBuilder {
  const container = moduleContainer('giveaways');
  addText(container, `### ${prize} Drop\n\nClick the button below to claim!`);
  addSeparator(container, 'small');
  addFields(container, [
    { name: 'Claimed', value: `${currentWinners.length}/${maxWinners}`, inline: true },
    { name: 'Remaining', value: `${Math.max(0, maxWinners - currentWinners.length)}`, inline: true },
  ]);
  return container;
}

export function buildGiveawayComponents(giveaway: GiveawayData, config: GiveawayConfig): ActionRowBuilder<ButtonBuilder>[] {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`giveaway_enter_${giveaway.id}`).setLabel('Enter').setEmoji(config.emoji).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`giveaway_entries_${giveaway.id}`).setLabel(`${giveaway.entryCount}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
  )];
}

export async function formatRequirements(requirements: GiveawayRequirement[], guild: Guild): Promise<string> {
  if (!requirements.length) return 'None';
  return requirements.map((req) => {
    if (req.type === 'role') {
      const role = guild.roles.cache.get(req.value as string);
      return `Have role: ${role?.name || 'Unknown'}`;
    }
    return `${req.type}: ${req.value}+`;
  }).join('\n');
}

export async function logGiveawayAction(guild: Guild, config: GiveawayConfig, action: string, giveawayId: number, details?: string): Promise<void> {
  logger.info(`[${guild.name}] Giveaway ${action}: #${giveawayId} ${details || ''}`);
}
