import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  isDJ,
  getMusicConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  module: 'music',
  permissionPath: 'music.skip',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.guild?.members.cache.get(interaction.user.id);

    // Check if user is in a voice channel
    if (!member?.voice.channel) {
      const embed = new EmbedBuilder()
        .setDescription('You must be in a voice channel to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    const queue = getQueue(interaction.guild!.id);

    // Check if there's an active queue
    if (!queue || queue.tracks.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('There is no music currently playing.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Check if user is in the same voice channel as the bot
    if (queue.voiceChannelId !== member.voice.channel.id) {
      const embed = new EmbedBuilder()
        .setDescription('You must be in the same voice channel as the bot to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Check DJ requirement
    const config = await getMusicConfig(interaction.guild!.id);
    if (!member || !isDJ(member, config)) {
      const embed = new EmbedBuilder()
        .setDescription('You must be a DJ to use this command.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Get current track before skipping
    const currentTrack = queue.tracks[0];

    // If loop is set to 'track', disable it before skipping
    if ((queue as any).loopMode === 'track') {
      (queue as any).loopMode = 'off';
    }

    // Remove and skip current track
    queue.tracks.shift();

    // Lavalink: if (queue.tracks.length > 0) {
    //   player.playTrack({ track: { encoded: queue.tracks[0].encoded } });
    // } else {
    //   player.stopTrack();
    // }

    const embed = new EmbedBuilder()
      .setTitle('Track Skipped')
      .setDescription(
        `Skipped: **${currentTrack.title}**\nby ${currentTrack.author}`
      );

    if (queue.tracks.length > 0) {
      embed.addFields([
        {
          name: 'Now Playing',
          value: `**${queue.tracks[0].title}**\nby ${queue.tracks[0].author}`,
          inline: false,
        },
      ]);
      embed.setColor(0x51cf66);
    } else {
      embed.setDescription(
        `${embed.data.description}\n\nQueue is now empty.`
      );
      embed.setColor(0xff6b6b);
    }

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
