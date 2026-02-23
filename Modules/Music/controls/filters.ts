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
  getFilterPreset,
} from '../helpers';

const FILTER_CHOICES = [
  'bassboost',
  'nightcore',
  'vaporwave',
  '8d',
  'karaoke',
  'tremolo',
  'vibrato',
  'lowpass',
  'highpass',
  'pop',
  'soft',
  'treblebass',
  'clear',
] as const;

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Apply audio filters to the current track')
    .addStringOption((opt) =>
      opt
        .setName('preset')
        .setDescription('Filter preset to apply')
        .setRequired(true)
        .addChoices(...FILTER_CHOICES.map((f) => ({ name: f, value: f })))
    ),

  module: 'music',
  premiumFeature: 'music.advanced',
  permissionPath: 'music.filters',

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

    // Check DJ permissions if required
    if (requiresDJ('filters', config) && !isDJ(member, config)) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('DJ Only')
            .setDescription('Only DJs can apply filters.'),
        ],
      });
      return;
    }

    const preset = interaction.options.getString('preset', true) as typeof FILTER_CHOICES[number];

    // Handle 'clear' to remove all filters
    if (preset === 'clear') {
      queue.filters = [];

      // TODO: Clear all filters on Lavalink player
      // await lavaliinkPlayer.clearFilters();

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Success)
            .setTitle('✨ Filters Cleared')
            .setDescription('All audio filters have been removed.'),
        ],
      });
      return;
    }

    // Get filter preset settings
    const filterSettings = getFilterPreset(preset);
    if (!filterSettings) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Error)
            .setTitle('Unknown Filter')
            .setDescription(`The filter preset **${preset}** is not recognized.`),
        ],
      });
      return;
    }

    // Add or toggle filter
    if (queue.filters.includes(preset)) {
      queue.filters = queue.filters.filter((f) => f !== preset);
    } else {
      queue.filters.push(preset);
    }

    // TODO: Apply filters to Lavalink player
    // await lavaliinkPlayer.setFilters(queue.filters.map(f => getFilterPreset(f)));

    const activeFilters =
      queue.filters.length > 0
        ? queue.filters.join(', ')
        : 'None';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Success)
          .setTitle('🎚️ Filters Updated')
          .setDescription(
            `Filter **${preset}** has been ${
              queue.filters.includes(preset) ? 'applied' : 'removed'
            }.`
          )
          .addFields({
            name: 'Active Filters',
            value: activeFilters,
            inline: false,
          }),
      ],
    });
  },
};

export default command;
