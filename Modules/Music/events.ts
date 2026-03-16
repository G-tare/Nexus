import { Collection, TextChannel, Events, MessageFlags } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, addFields, v2Payload } from '../../Shared/src/utils/componentsV2';

// Track leave timers per guild
const leaveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Handle leaving when queue finishes
 */
async function handleLeaveOnFinish(guildId: string, config: any, client: any) {
  const delay = (config.leaveOnFinishDelay ?? 30) * 1000;

  const timerId = setTimeout(async () => {
    try {
      // TODO: Disconnect player
      // const player = lavalinkManager.getPlayer(guildId);
      // if (player) {
      //   await player.destroy();
      // }
      leaveTimers.delete(guildId);
    } catch (error) {
      console.error('Error leaving on finish:', error);
    }
  }, delay);

  leaveTimers.set(guildId, timerId);
}

/**
 * Clean up timers on process exit
 */
export function cleanupMusicTimers() {
  for (const [guildId, timerId] of leaveTimers.entries()) {
    clearTimeout(timerId);
  }
  leaveTimers.clear();
}

export const musicEvents: ModuleEvent[] = [
  { event: 'playerTrackStart',
    once: false,
    handler: async (client: any, guildId: string, track: any) => {
      try {
        const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
        const config = (_cfgResult?.config ?? {}) as Record<string, any>;

        // Send now playing announcement if enabled
        if (config.announceNowPlaying && config.announcementChannelId) {
          try {
            const guild = await client.guilds.fetch(guildId);
            const channel = (await guild.channels.fetch(config.announcementChannelId)) as TextChannel;

            if (channel && channel.isTextBased()) {
              const container = moduleContainer('music');
              addText(container, `### 🎵 Now Playing\n**${track.title || 'Unknown'}**`);
              addFields(container, [
                { name: 'Duration',
                  value: `${Math.floor(track.duration / 1000)}s`,
                  inline: true,
                },
                { name: 'Author',
                  value: track.author || 'Unknown',
                  inline: true,
                },
              ]);

              await (channel as any).send(v2Payload([container]));
            }
          } catch (err) {
            console.error('Error sending now playing announcement:', err);
          }
        }

        // Clear voteskip votes from Redis
        // TODO: Implement Redis voteskip vote clearing
        // await redis.del(`voteskip:${guildId}`);
      } catch (error) {
        console.error('Error in playerTrackStart event:', error);
      }
    },
  },
  { event: 'playerTrackEnd',
    once: false,
    handler: async (client: any, guildId: string, track: any) => {
      try {
        const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
        const config = (_cfgResult?.config ?? {}) as Record<string, any>;
        // TODO: Get player from Lavalink manager
        // const player = lavalinkManager.getPlayer(guildId);

        // if (!player) return;

        // // Handle loop modes
        // if (config.loopMode === 'track') {
        //   // Replay current track
        //   await player.queue.unshift(track);
        //   await player.play();
        //   return;
        // }

        // if (config.loopMode === 'queue') {
        //   // Push to end of queue
        //   await player.queue.push(track);
        // }

        // // Handle autoplay
        // if (config.autoplayEnabled && player.queue.length === 0) {
        //   await handleAutoQueue(guildId, track);
        //   return;
        // }

        // // If queue empty and no autoplay, handle leave behavior
        // if (player.queue.length === 0 && !config.autoplayEnabled) {
        //   await handleLeaveOnFinish(guildId, config);
        // }
      } catch (error) {
        console.error('Error in playerTrackEnd event:', error);
      }
    },
  },
  { event: 'playerEmpty',
    once: false,
    handler: async (client: any, guildId: string) => {
      try {
        const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
        const config = (_cfgResult?.config ?? {}) as Record<string, any>;

        // If 24/7 mode, stay in VC
        if (config.twentyFourSeven) {
          return;
        }

        // If leaveOnFinish, start leave timer
        if (config.leaveOnFinish) {
          await handleLeaveOnFinish(guildId, config, client);
        }
      } catch (error) {
        console.error('Error in playerEmpty event:', error);
      }
    },
  },
  { event: Events.VoiceStateUpdate,
    once: false,
    handler: async (oldState: any, newState: any) => {
      try {
        const guildId = oldState.guild.id;
        const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
        const config = (_cfgResult?.config ?? {}) as Record<string, any>;
        // TODO: Get player from Lavalink
        // const player = lavalinkManager.getPlayer(guildId);

        // if (!player) return;

        // // Check if bot's VC became empty
        // const botVoiceChannel = oldState.guild.members.me?.voice.channel;
        // if (!botVoiceChannel) return;

        // const membersInVC = botVoiceChannel.members.filter((m) => !m.user.bot).size;

        // if (membersInVC === 0) {
        //   // If 24/7 mode, stay
        //   if (config.twentyFourSeven) {
        //     return;
        //   }

        //   // If leaveOnEmpty, start timer
        //   if (config.leaveOnEmpty) {
        //     const delay = (config.leaveOnEmptyDelay ?? 30) * 1000;
        //     const timerId = setTimeout(async () => {
        //       await player.destroy();
        //       leaveTimers.delete(guildId);
        //     }, delay);

        //     leaveTimers.set(guildId, timerId);
        //   }
        // } else if (membersInVC > 0) {
        //   // Someone joined back, cancel leave timer
        //   const timerId = leaveTimers.get(guildId);
        //   if (timerId) {
        //     clearTimeout(timerId);
        //     leaveTimers.delete(guildId);
        //   }
        // }
      } catch (error) {
        console.error('Error in voiceStateUpdate event:', error);
      }
    },
  },
  { event: 'autoQueueHandler',
    once: false,
    handler: async (client: any, guildId: string) => {
      try {
        const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
        const config = (_cfgResult?.config ?? {}) as Record<string, any>;

        if (!config.autoplayEnabled) {
          return;
        }

        // TODO: Get last/current track from player
        // const player = lavalinkManager.getPlayer(guildId);
        // const track = player.queue.current || player.queue[player.queue.length - 1];

        // if (!track) return;

        // // Search for related tracks via Lavalink recommendations
        // const recommendations = await lavalinkManager.getRecommendations(track.identifier);

        // if (recommendations && recommendations.length > 0) {
        //   const nextTrack = recommendations[0];
        //   await player.queue.add(nextTrack);
        // }
      } catch (error) {
        console.error('Error in autoQueueHandler:', error);
      }
    },
  },
];
