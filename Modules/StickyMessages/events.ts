import { Client, ChannelType, TextChannel, Events } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('StickyMessages');
import { StickyMessagesHelper } from './helpers';
import { activityTracker } from './tracker';
import { getDb } from '../../Shared/src/database/connection';

const RATE_LIMIT = 5000; // 5 seconds minimum between re-sticks
const lastRestickTime: Map<string, number> = new Map();

export const stickyMessagesEvents: ModuleEvent[] = [
  { event: Events.MessageCreate,
    once: false,
    handler: async (message) => {
      try {
        // Ignore bot messages and DMs
        if (message.author.bot || !message.guild) return;

        // Only process text channels
        if (message.channel.type !== ChannelType.GuildText) return;

        const channelId = message.channelId;
        const guildId = message.guildId!;

        // Track message activity
        activityTracker.recordMessage(channelId);

        const db = getDb();
        const helper = new StickyMessagesHelper(db);

        // Get all active stickies for this channel
        const stickies = await helper.getStickyMessagesByChannel(channelId);
        if (stickies.length === 0) return;

        // Get guild config
        const config = await helper.getGuildConfig(guildId);
        if (!config.enabled) return;

        // Process each sticky
        for (const sticky of stickies) {
          await processStickyMessage(
            message.client,
            helper,
            db,
            sticky,
            config.mode,
            config.deleteBotMessage
          );
        }
      } catch (error) {
        logger.error(`Error handling messageCreate for sticky messages: ${error}`);
      }
    }
  },
  { event: Events.MessageDelete,
    once: false,
    handler: async (message) => {
      try {
        if (!message.guild) return;

        const db = getDb();
        const helper = new StickyMessagesHelper(db);

        // Find stickies that were pointing to this message
        const stickies = await helper.getStickyMessagesByGuild(message.guildId!);

        for (const sticky of stickies) {
          if (sticky.currentMessageId === message.id) {
            // Mark as needing resend
            await helper.updateStickyMessage(sticky.id, {
              currentMessageId: null,
              messagesSince: 0,
            });

            // Resend the sticky
            try {
              const channel = await message.guild.channels.fetch(
                sticky.channelId
              );
              if (channel?.isTextBased()) {
                await sendStickyMessage(
                  channel as TextChannel,
                  sticky,
                  helper
                );
              }
            } catch (error) {
              logger.error(
                `Failed to resend deleted sticky message: ${error}`
              );
            }
          }
        }
      } catch (error) {
        logger.error(
          `Error handling messageDelete for sticky messages: ${error}`
        );
      }
    }
  },
  { event: Events.ChannelDelete,
    once: false,
    handler: async (channel) => {
      try {
        if (!channel.isTextBased() || !channel.guild) return;

        const db = getDb();
        const helper = new StickyMessagesHelper(db);

        // Deactivate all stickies in this channel
        const stickies = await helper.getStickyMessagesByChannel(channel.id);
        for (const sticky of stickies) {
          await helper.deactivateStickyMessage(sticky.id);
          logger.info(
            `Deactivated sticky message ${sticky.id} due to channel deletion`
          );
        }
      } catch (error) {
        logger.error(`Error handling channelDelete for sticky messages: ${error}`);
      }
    }
  }
];

async function processStickyMessage(
  client: Client,
  helper: StickyMessagesHelper,
  db: any,
  sticky: any,
  mode: 'interval' | 'activity' | 'hybrid',
  deleteBotMessage: boolean
): Promise<void> {
  try {
    // Increment messages since
    const updated = await helper.incrementMessagesSince(sticky.id);

    // Calculate threshold based on mode
    const threshold = activityTracker.getThreshold(
      sticky.channelId,
      sticky.interval,
      mode
    );

    // Check if we should re-stick
    if (updated.messagesSince >= threshold) {
      // Check rate limit
      const lastTime = lastRestickTime.get(sticky.id) || 0;
      if (Date.now() - lastTime < RATE_LIMIT) {
        return;
      }

      lastRestickTime.set(sticky.id, Date.now());

      // Get the channel
      const guild = await client.guilds.fetch(sticky.guildId).catch(() => null);
      if (!guild) {
        await helper.deactivateStickyMessage(sticky.id);
        return;
      }

      const channel = await guild.channels
        .fetch(sticky.channelId)
        .catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await helper.deactivateStickyMessage(sticky.id);
        return;
      }

      // Delete old message if it exists and enabled
      if (deleteBotMessage && sticky.currentMessageId) {
        try {
          const oldMessage = await (channel as TextChannel).messages.fetch(
            sticky.currentMessageId
          );
          await oldMessage.delete();
        } catch (error) {
          logger.debug(
            `Failed to delete old sticky message ${sticky.currentMessageId}: ${error}`
          );
        }
      }

      // Send new message
      await sendStickyMessage(channel as TextChannel, sticky, helper);
    }
  } catch (error) {
    logger.error(`Error processing sticky message: ${error}`);
  }
}

async function sendStickyMessage(
  channel: TextChannel,
  sticky: any,
  helper: StickyMessagesHelper
): Promise<void> {
  try {
    const embedData = helper.buildEmbedData(sticky.embedData);

    const sentMessage = await (channel as any).send({
      content: sticky.content || undefined,
      embeds: embedData ? [embedData] : [],
    });

    // Update the current message ID and reset counter
    await helper.updateStickyMessage(sticky.id, {
      currentMessageId: sentMessage.id,
      messagesSince: 0,
    });

    logger.debug(
      `Resent sticky message ${sticky.id} in channel ${channel.id}`
    );
  } catch (error) {
    logger.error(`Failed to send sticky message: ${error}`);

    // If we can't send, deactivate the sticky
    if (
      error instanceof Error &&
      (error as any).message.includes('permissions')
    ) {
      await helper.deactivateStickyMessage(sticky.id);
    }
  }
}
