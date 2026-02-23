import { Events, Message, EmbedBuilder } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getCountingConfig,
  incrementCount,
  handleWrongCount,
  updateUserStats,
  checkMilestone,
  evaluateMath,
  saveCountingConfig,
  updateGlobalLeaderboard,
  getCountingConfig as getConfig,
  getCurrentCount,
} from './helpers';

async function handleWrongCountMessage(message: Message, config: any): Promise<void> {
  const guildId = message.guildId!;
  const userId = message.author.id;
  const oldCount = config.currentCount;

  try {
    const result = await handleWrongCount(guildId, userId);
    await updateUserStats(guildId, userId, false);

    if (result.usedLife) {
      // User had a life to use
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
      // Count was reset
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
      // Wrong count but no lives or reset
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

export const countingEvents: ModuleEvent[] = [
  { event: Events.MessageCreate,
    once: false,
    handler: async (message: Message) => {
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

      // If we couldn't parse a valid number, treat as wrong count
      if (parsedNumber === null) {
        await handleWrongCountMessage(message, config);
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
    }
  }
];
