import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  getMusicConfig,
  isInSameVoice,
  isInVoiceChannel,
} from '../helpers';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { errorContainer, warningContainer, successContainer, moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('voteskip')
    .setDescription('Vote to skip the current track (democratic voting)'),

  module: 'music',
  premiumFeature: 'music.basic',
  permissionPath: 'music.voteskip',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const member = interaction.member as any;
    const config = await getMusicConfig(guildId);
    const queue = getQueue(guildId);

    // Check if user is in voice
    if (!isInVoiceChannel(member)) {
      await interaction.editReply(v2Payload([errorContainer('Not in Voice Channel', 'You must be in a voice channel to use this command.')]));
      return;
    }

    // Check if queue exists
    if (!queue || !queue.currentTrack) {
      await interaction.editReply(v2Payload([errorContainer('No Active Queue', 'There is no track currently playing.')]));
      return;
    }

    // Check if user is in same voice channel
    if (!isInSameVoice(member, queue)) {
      await interaction.editReply(v2Payload([errorContainer('Wrong Voice Channel', 'You must be in the same voice channel as the bot.')]));
      return;
    }

    // Check if vote skip is enabled
    if (!config.voteSkipEnabled) {
      await interaction.editReply(v2Payload([errorContainer('Vote Skip Disabled', 'Vote skip is disabled on this server.')]));
      return;
    }

    const voteSkipKey = `voteskip:${guildId}`;

    // Get current votes
    const currentVotes = cache.smembers(voteSkipKey) || [];
    const voteSet = new Set(currentVotes);

    // Check if user already voted
    if (voteSet.has(userId)) {
      await interaction.editReply(v2Payload([warningContainer('Already Voted', 'You have already voted to skip this track.')]));
      return;
    }

    // Add user's vote
    voteSet.add(userId);
    cache.sadd(voteSkipKey, userId);

    // Set expiration - votes should clear when track changes
    // Set to 10 minutes as a safety measure
    cache.expire(voteSkipKey, 600);

    // Get voice channel member count (excluding bot)
    const voiceChannel = member.guild.channels.cache.get(queue.voiceChannelId);
    if (!voiceChannel || !voiceChannel.isVoiceBased()) {
      await interaction.editReply(v2Payload([errorContainer('Error', 'Could not access the voice channel.')]));
      return;
    }

    const memberCount = Math.max(1, voiceChannel.members.size - 1); // Exclude bot
    const votesNeeded = Math.ceil((memberCount * config.voteSkipPercent) / 100);
    const currentVoteCount = voteSet.size;

    // Check if skip threshold is reached
    if (currentVoteCount >= votesNeeded) {
      // Skip the track
      cache.del(voteSkipKey);

      // TODO: Skip the current track on Lavalink
      // await lavaliinkPlayer.skip();

      const container = successContainer('⏭️ Track Skipped', `The track has been skipped with **${currentVoteCount}/${votesNeeded}** votes.`);
      addFields(container, [
        {
          name: 'Skipped Track',
          value: `**${queue.currentTrack.title}**\nby ${queue.currentTrack.author}`,
          inline: false,
        },
      ]);

      await interaction.editReply(v2Payload([container]));
      return;
    }

    // Not enough votes yet
    const votesRemaining = votesNeeded - currentVoteCount;
    const progressBar = buildProgressBar(currentVoteCount, votesNeeded);

    const container = moduleContainer('music');
    addText(container, `### 🗳️ Vote Registered\nYour vote to skip has been registered.\n\n${progressBar}`);
    addFields(container, [
      {
        name: 'Current Votes',
        value: `${currentVoteCount}/${votesNeeded}`,
        inline: true,
      },
      {
        name: 'Votes Needed',
        value: `${votesRemaining} more`,
        inline: true,
      },
    ]);

    await interaction.editReply(v2Payload([container]));
  },
};

/**
 * Build a visual progress bar for votes
 */
function buildProgressBar(current: number, needed: number): string {
  const percentage = Math.min(1, current / needed);
  const filledLength = Math.round(percentage * 10);

  let bar = '';
  for (let i = 0; i < 10; i++) {
    bar += i < filledLength ? '█' : '░';
  }

  return `${bar} ${(percentage * 100).toFixed(0)}%`;
}

export default command;
