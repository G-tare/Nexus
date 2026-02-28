import { Events, Message, PartialMessage, EmbedBuilder, TextChannel } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getRedis } from '../../Shared/src/database/connection';
import {
  getCountingConfig,
  incrementCount,
  handleWrongCount,
  updateUserStats,
  checkMilestone,
  evaluateMath,
  saveCountingConfig,
  updateGlobalLeaderboard,
} from './helpers';

// ============================================
// In-memory cache for recent counting messages
// Maps messageId → { number, authorId, authorTag }
// Used to detect when someone deletes their counted number
// ============================================

interface CachedCount {
  number: number;
  authorId: string;
  authorTag: string;
  guildId: string;
  channelId: string;
}

const recentCounts = new Map<string, CachedCount>();

// Clean up entries older than 1 hour (by limiting map size)
const MAX_CACHED_COUNTS = 5000;

function cacheCount(messageId: string, data: CachedCount): void {
  recentCounts.set(messageId, data);
  // Prune if too large — delete oldest entries
  if (recentCounts.size > MAX_CACHED_COUNTS) {
    const iterator = recentCounts.keys();
    for (let i = 0; i < 500; i++) {
      const key = iterator.next().value;
      if (key) recentCounts.delete(key);
    }
  }
}

// ============================================
// Delete Anti-Cheat Strike System
// Strike thresholds:
//   1st: warning
//   2nd: banned from counting for 10 numbers
//   3rd: banned for 100 numbers
//   4th: banned for 500 numbers
//   5th+: permanent ban (until admin removes it)
// ============================================

const STRIKE_PENALTIES = [0, 10, 100, 500]; // index 0 = warning only

async function getDeleteStrikes(guildId: string, userId: string): Promise<number> {
  const val = await getRedis().get(`counting:strikes:${guildId}:${userId}`);
  return val ? parseInt(val, 10) : 0;
}

async function addDeleteStrike(guildId: string, userId: string): Promise<number> {
  const key = `counting:strikes:${guildId}:${userId}`;
  const newCount = await getRedis().incr(key);
  // Strikes persist for 90 days
  await getRedis().expire(key, 7776000);
  return newCount;
}

/**
 * Ban a user from counting for N numbers.
 * banFor = 0 means permanent (until manually removed).
 */
async function setCountingBan(guildId: string, userId: string, banFor: number): Promise<void> {
  const key = `counting:ban:${guildId}:${userId}`;
  if (banFor === 0) {
    // Permanent ban — no expiry, value = "permanent"
    await getRedis().set(key, 'permanent');
  } else {
    // Ban for N numbers — store the current count + banFor as the "unban at" number
    const config = await getCountingConfig(guildId);
    const unbanAt = config.currentCount + banFor;
    await getRedis().set(key, String(unbanAt));
  }
}

/**
 * Check if a user is banned from counting.
 * Returns true if banned, false if not (or if ban has expired based on count progress).
 */
async function isCountingBanned(guildId: string, userId: string): Promise<boolean> {
  const key = `counting:ban:${guildId}:${userId}`;
  const val = await getRedis().get(key);
  if (!val) return false;
  if (val === 'permanent') return true;

  // Number-based ban — check if count has progressed past the threshold
  const unbanAt = parseInt(val, 10);
  const config = await getCountingConfig(guildId);
  if (config.currentCount >= unbanAt) {
    // Ban expired — remove it
    await getRedis().del(key);
    return false;
  }
  return true;
}

// ============================================
// Wrong Count Handler
// ============================================

async function handleWrongCountMessage(message: Message, config: any): Promise<void> {
  const guildId = message.guildId!;
  const userId = message.author.id;
  const oldCount = config.currentCount;

  try {
    const result = await handleWrongCount(guildId, userId);
    await updateUserStats(guildId, userId, false);

    if (result.usedLife) {
      const replyEmbed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('❌ Wrong Number!')
        .setDescription(
          `Expected **${oldCount + 1}**, but you counted **${message.content}**.\n\n` +
          `🛡️ **Saved by a life!** You have **${result.livesRemaining}** ${result.livesRemaining === 1 ? 'life' : 'lives'} remaining.`
        )
        .setTimestamp();

      await message.reply({ embeds: [replyEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
    } else if (result.reset) {
      const resetEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💥 Count Reset!')
        .setDescription(
          `${message.author.toString()} broke the streak with **${message.content}** (expected **${oldCount + 1}**).\n\n` +
          `The count has been reset from **${oldCount}** to **0**.`
        )
        .setTimestamp();

      await message.reply({ embeds: [resetEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
    } else {
      const wrongEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Wrong Number!')
        .setDescription(`Expected **${oldCount + 1}**, but you counted **${message.content}**.`)
        .setTimestamp();

      await message.reply({ embeds: [wrongEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
    }

    // Delete wrong message if enabled
    if (config.deleteWrongNumbers) {
      await message.delete().catch(() => {});
    }
  } catch (error) {
    console.error('[Counting] Error handling wrong count:', error);
  }
}

// ============================================
// Main Counting Event (MessageCreate)
// ============================================

const countingHandler: ModuleEvent = {
  event: Events.MessageCreate,
  once: false,
  async handler(message: Message) {
    // Skip bots
    if (message.author.bot) return;

    const config = await getCountingConfig(message.guildId!);

    // Check if counting is enabled
    if (!config.enabled || !config.channelId) return;

    // Check if this is the counting channel
    if (message.channelId !== config.channelId) return;

    // Parse the message content
    let parsedNumber: number | null = null;
    const trimmedContent = message.content.trim();

    // Try to parse as direct number
    const directNumber = parseInt(trimmedContent, 10);
    if (!isNaN(directNumber) && directNumber >= 0 && trimmedContent === String(directNumber)) {
      parsedNumber = directNumber;
    } else if (config.mathMode) {
      // Try to evaluate as math expression
      parsedNumber = evaluateMath(trimmedContent);
    }

    // If we couldn't parse a valid number...
    if (parsedNumber === null) {
      // Non-strict mode: ignore non-number messages — let people talk freely
      if (!config.strictMode) return;
      // Strict mode: any non-number text is treated as breaking the streak
      await handleWrongCountMessage(message, config);
      return;
    }

    // Check if user is banned from counting
    const banned = await isCountingBanned(message.guildId!, message.author.id);
    if (banned) {
      const banEmbed = new EmbedBuilder()
        .setColor(0xff6600)
        .setDescription(`${message.author.toString()}, you're currently banned from counting for deleting numbers.`)
        .setTimestamp();

      await message.reply({ embeds: [banEmbed], allowedMentions: { repliedUser: false } }).catch(() => {});
      // Don't count this as a wrong count — just reject silently
      if (config.deleteWrongNumbers) {
        await message.delete().catch(() => {});
      }
      return;
    }

    // Check if it's the expected next number
    const expectedNumber = config.currentCount + 1;
    if (parsedNumber !== expectedNumber) {
      await handleWrongCountMessage(message, config);
      return;
    }

    // Check if same person is counting twice in a row (if not allowed)
    if (!config.allowDoubleCount && config.lastCounterId === message.author.id) {
      await handleWrongCountMessage(message, config);
      return;
    }

    // CORRECT COUNT
    try {
      await incrementCount(message.guildId!, message.author.id, parsedNumber);
      await updateUserStats(message.guildId!, message.author.id, true, parsedNumber);

      // Cache this message for delete detection
      cacheCount(message.id, {
        number: parsedNumber,
        authorId: message.author.id,
        authorTag: message.author.tag,
        guildId: message.guildId!,
        channelId: message.channelId,
      });

      // React with checkmark if enabled
      if (config.reactOnCorrect) {
        await message.react('✅').catch(() => {});
      }

      // Check for milestones
      if (config.notifyOnMilestone && checkMilestone(parsedNumber, config.milestoneInterval)) {
        const milestoneEmbed = new EmbedBuilder()
          .setColor(0x00aa00)
          .setTitle(`🎉 Milestone Reached: ${parsedNumber}!`)
          .setDescription(`${message.author.toString()} counted to the milestone!`)
          .setTimestamp();

        await (message.channel as any).send({ embeds: [milestoneEmbed] }).catch(() => {});
      }

      // Check if new server record
      if (parsedNumber > config.highestCount) {
        const recordEmbed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🏆 New Server Record!')
          .setDescription(`${message.author.toString()} reached **${parsedNumber}**! Previous record: **${config.highestCount}**`)
          .setTimestamp();

        await (message.channel as any).send({ embeds: [recordEmbed] }).catch(() => {});

        // Update global leaderboard if enabled
        if (config.globalLeaderboardEnabled) {
          const guildName = message.guild?.name || 'Unknown';
          await updateGlobalLeaderboard(message.guildId!, guildName, parsedNumber);
        }
      }
    } catch (error) {
      console.error('[Counting] Error handling correct count:', error);
    }
  },
};

// ============================================
// Delete Detection (MessageDelete)
// ============================================

const deleteDetectionHandler: ModuleEvent = {
  event: Events.MessageDelete,
  once: false,
  async handler(message: Message | PartialMessage) {
    // Need guild context
    if (!message.guildId) return;

    // Check if this was a cached counting message
    const cached = recentCounts.get(message.id);
    if (!cached) return;

    // Remove from cache
    recentCounts.delete(message.id);

    // Verify this is still the counting channel
    const config = await getCountingConfig(cached.guildId);
    if (!config.enabled || config.channelId !== cached.channelId) return;

    // Don't flag if the bot itself deleted the message (wrong number cleanup)
    // We can't always tell who deleted it, but we skip bot-authored messages
    if (message.author?.bot) return;

    // Someone deleted a counted number — this is suspicious
    const strikes = await addDeleteStrike(cached.guildId, cached.authorId);

    // Get the channel to send the alert
    const channel = message.client?.channels.cache.get(cached.channelId) as TextChannel | undefined;
    if (!channel) return;

    // Always announce what the last number was
    let description = `<@${cached.authorId}> deleted their count of **${cached.number}**.\nThe last valid number was **${config.currentCount}**, so the next number is **${config.currentCount + 1}**.`;

    let penaltyText = '';

    if (strikes === 1) {
      // Warning
      penaltyText = '⚠️ **Warning** — Deleting counted numbers to trick others is not allowed. Next time will result in a counting ban.';
    } else if (strikes === 2) {
      await setCountingBan(cached.guildId, cached.authorId, STRIKE_PENALTIES[1]);
      penaltyText = `🚫 **Strike ${strikes}** — <@${cached.authorId}> is banned from counting for the next **${STRIKE_PENALTIES[1]} numbers**.`;
    } else if (strikes === 3) {
      await setCountingBan(cached.guildId, cached.authorId, STRIKE_PENALTIES[2]);
      penaltyText = `🚫 **Strike ${strikes}** — <@${cached.authorId}> is banned from counting for the next **${STRIKE_PENALTIES[2]} numbers**.`;
    } else if (strikes === 4) {
      await setCountingBan(cached.guildId, cached.authorId, STRIKE_PENALTIES[3]);
      penaltyText = `🚫 **Strike ${strikes}** — <@${cached.authorId}> is banned from counting for the next **${STRIKE_PENALTIES[3]} numbers**.`;
    } else {
      // 5th+ strike — permanent ban
      await setCountingBan(cached.guildId, cached.authorId, 0);
      penaltyText = `🔨 **Strike ${strikes}** — <@${cached.authorId}> has been permanently banned from counting. A server admin can remove this with \`/counting-config unban-counter\`.`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('🗑️ Deleted Count Detected')
      .setDescription(`${description}\n\n${penaltyText}`)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  },
};

export const countingEvents: ModuleEvent[] = [
  countingHandler,
  deleteDetectionHandler,
];
