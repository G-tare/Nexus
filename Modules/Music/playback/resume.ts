import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback'),

  module: 'music',
  permissionPath: 'music.resume',
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

    // Check if already playing
    if (!queue.paused) {
      const embed = new EmbedBuilder()
        .setDescription('Music is already playing.')
        .setColor(0xff0000);
      return interaction.editReply({
        embeds: [embed],
      });
    }

    // Resume playback
    queue.paused = false;

    // Lavalink: player.pause(false);

    const embed = new EmbedBuilder()
      .setTitle('Playback Resumed')
      .setDescription('Music is now playing.')
      .setColor(0x51cf66);

    return interaction.editReply({ embeds: [embed] });
  },
};

export default command;
