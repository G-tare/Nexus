import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';
import {
  getQueue,
  getMusicConfig,
  isDJ,
  requiresDJ,
  isInSameVoice,
  isInVoiceChannel,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set or view the current playback volume')
    .addIntegerOption((opt) =>
      opt
        .setName('level')
        .setDescription('Volume level (0-150, optional)')
        .setMinValue(0)
        .setMaxValue(150)
        .setRequired(false)
    ),

  module: 'music',
  premiumFeature: 'music.basic',
  permissionPath: 'music.volume',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const member = interaction.member as any;
    const config = await getMusicConfig(guildId);
    const queue = getQueue(guildId);

    // Check if user is in voice
    if (!isInVoiceChannel(member)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('Not in Voice Channel')
            .setDescription('You must be in a voice channel to use this command.'),
        ],
      });
      return;
    }

    // Check if queue exists
    if (!queue) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('No Active Queue')
            .setDescription('There is no active music queue in this server.'),
        ],
      });
      return;
    }

    // Check if user is in same voice channel
    if (!isInSameVoice(member, queue)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('Wrong Voice Channel')
            .setDescription('You must be in the same voice channel as the bot.'),
        ],
      });
      return;
    }

    const level = interaction.options.getInteger('level');

    // If no level provided, show current volume
    if (level === null) {
      const volumeBar = buildVolumeBar(queue.volume, config.maxVolume);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Music)
            .setTitle('🔊 Current Volume')
            .setDescription(volumeBar)
            .addFields({
              name: 'Volume Level',
              value: `${queue.volume}/${config.maxVolume}`,
              inline: false,
            }),
        ],
      });
      return;
    }

    // Check DJ permissions if required
    if (requiresDJ('volume', config) && !isDJ(member, config)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('DJ Only')
            .setDescription('Only DJs can change the volume.'),
        ],
      });
      return;
    }

    // Validate level is within maxVolume
    if (level > config.maxVolume) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Warning)
            .setTitle('Volume Too High')
            .setDescription(
              `Maximum volume is **${config.maxVolume}%**. Setting volume to max.`
            ),
        ],
      });
      queue.volume = config.maxVolume;
    } else {
      queue.volume = level;
    }

    // TODO: Apply volume to Lavalink player
    // await lavaliinkPlayer.setVolume(queue.volume);

    const volumeBar = buildVolumeBar(queue.volume, config.maxVolume);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Success)
          .setTitle('🔊 Volume Updated')
          .setDescription(volumeBar)
          .addFields({
            name: 'New Volume',
            value: `${queue.volume}/${config.maxVolume}`,
            inline: false,
          }),
      ],
    });
  },
};

/**
 * Build a visual volume bar
 */
function buildVolumeBar(current: number, max: number): string {
  const percentage = (current / max) * 100;
  const filledLength = Math.round((percentage / 100) * 10);

  let bar = '';
  for (let i = 0; i < 10; i++) {
    bar += i < filledLength ? '█' : '░';
  }

  return `${bar} ${percentage.toFixed(0)}%`;
}

export default command;
