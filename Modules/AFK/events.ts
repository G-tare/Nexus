import { Events, Message, ChannelType } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getAFK,
  getAFKConfig,
  removeAFK,
  trackPing,
  buildAFKEmbed,
  buildPingSummaryEmbed,
  getPings,
  clearPings,
} from './helpers';

export const afkEvents: ModuleEvent[] = [
  { event: Events.MessageCreate,
    once: false,
    async handler(message: Message) {
      // Ignore bot messages and DMs
      if (message.author.bot || !message.guild) return;

      // Check if AFK module is enabled
      const config = await getAFKConfig(message.guildId!);
      if (!config.enabled) return;

      // ===== MENTION HANDLER =====
      if (message.mentions.has(message.client.user!.id)) {
        // Check each mentioned user for AFK status
        for (const mentionedUser of message.mentions.users.values()) {
          if (mentionedUser.bot) continue;

          const afkData = await getAFK(message.guildId!, mentionedUser.id);
          if (afkData) {
            // User is AFK - respond in channel
            const embed = buildAFKEmbed(afkData);

            try {
              await message.reply({
                embeds: [embed],
                allowedMentions: { repliedUser: false },
              });
            } catch (err) {
              console.error('Error replying to AFK mention:', err);
            }

            // Track the ping
            try {
              const messageContent = message.content.length > 100
                ? message.content.slice(0, 97) + '...'
                : message.content;

              const channelName = message.channel.isDMBased()
                ? 'DM'
                : message.channel.name || 'unknown';

              await trackPing(message.guildId!, mentionedUser.id, {
                fromUserId: message.author.id,
                fromUsername: message.author.username,
                channelId: message.channelId,
                channelName,
                messageContent,
                timestamp: Math.floor(Date.now() / 1000),
              });
            } catch (err) {
              console.error('Error tracking ping:', err);
            }
          }
        }
      }

      // ===== RETURN HANDLER =====
      if (config.autoRemoveOnMessage) {
        const afkData = await getAFK(message.guildId!, message.author.id);
        if (afkData) {
          // User was AFK - remove status
          const removed = await removeAFK(message.guildId!, message.author.id);
          if (removed) {
            // Restore nickname if it was changed
            if (removed.nickname && message.member) {
              try {
                await message.member.setNickname(removed.nickname);
              } catch (err) {
                console.error('Error restoring nickname:', err);
              }
            }

            // Calculate AFK duration
            const durationMs = Date.now() - afkData.setAt.getTime();
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);
            let durationStr = '';
            if (hours > 0) durationStr += `${hours}h `;
            if (minutes > 0 || hours === 0) durationStr += `${minutes}m`;

            // Send welcome back message
            const welcomeMsg = await message.reply({
              content: `Welcome back ${message.author}! You were AFK for ${durationStr}.`,
              allowedMentions: { repliedUser: false },
            });

            // Delete welcome back message after 10 seconds
            setTimeout(() => {
              welcomeMsg.delete().catch(() => {});
            }, 10000);

            // Send pings via DM if applicable
            if (config.dmPingsOnReturn) {
              const pings = await getPings(message.guildId!, message.author.id);
              if (pings.length > 0) {
                try {
                  const pingsEmbed = buildPingSummaryEmbed(pings);
                  await message.author.send({ embeds: [pingsEmbed] });
                  await clearPings(message.guildId!, message.author.id);
                } catch (err) {
                  console.error('Error sending ping summary DM:', err);
                }
              }
            }
          }
        }
      }
    },
  },
];
