import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getQueue,
  deleteQueue,
  isDJ,
  getMusicConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),

  module: 'music',
  permissionPath: 'music.stop',
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

    // Lavalink: player.stopTrack();
    // Lavalink: player.disconnect(); (unless 24/7 mode is enabled)

    // Clear queue from memory
    deleteQueue(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setTitle('Playback Stopped')
      .setDescription('The queue has been cleared and playback has stopped.')
      .setColor(0xff6b6b);

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
