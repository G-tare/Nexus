import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue, formatDuration } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track with progress bar'),

  module: 'music',
  permissionPath: 'music.nowplaying',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

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

    const currentTrack = queue.tracks[0];
    const duration = currentTrack.duration;

    // Build progress bar
    const totalBars = 20;
    const filledBars = Math.round((queue.position / duration) * totalBars);
    const emptyBars = totalBars - filledBars;
    const progressBar =
      '█'.repeat(Math.max(0, filledBars - 1)) +
      '🔘' +
      '░'.repeat(Math.max(0, emptyBars - 1));

    // Format time strings
    const currentMinutes = Math.floor(queue.position / 60000);
    const currentSeconds = Math.floor((queue.position % 60000) / 1000);
    const currentTimeStr = `${currentMinutes}:${currentSeconds
      .toString()
      .padStart(2, '0')}`;

    const totalMinutes = Math.floor(duration / 60000);
    const totalSeconds = Math.floor((duration % 60000) / 1000);
    const totalTimeStr = `${totalMinutes}:${totalSeconds
      .toString()
      .padStart(2, '0')}`;

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('Now Playing')
      .setDescription(`**${currentTrack.title}**\nby ${currentTrack.author}`)
      .addFields([
        {
          name: 'Progress',
          value: `${progressBar}\n${currentTimeStr} / ${totalTimeStr}`,
          inline: false,
        },
        {
          name: 'Queue Position',
          value: `${queue.tracks.length} track(s) in queue`,
          inline: true,
        },
        {
          name: 'Volume',
          value: `${queue.volume}%`,
          inline: true,
        },
        {
          name: 'Loop Mode',
          value: queue.loop === 'off' ? 'Off' : queue.loop === 'queue' ? 'Queue' : 'Track',
          inline: true,
        },
      ])
      .setColor(0x2f3136);

    // Build action row with buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_pause_resume')
        .setLabel(queue.paused ? 'Resume' : 'Pause')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(queue.paused ? '▶️' : '⏸️'),
      new ButtonBuilder()
        .setCustomId('btn_skip')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏭️'),
      new ButtonBuilder()
        .setCustomId('btn_stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️'),
      new ButtonBuilder()
        .setCustomId('btn_loop')
        .setLabel(
          (queue as any).loopMode === 'off'
            ? 'Loop Off'
            : (queue as any).loopMode === 'queue'
              ? 'Loop Queue'
              : 'Loop Track'
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁')
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  },
};

export default command;
