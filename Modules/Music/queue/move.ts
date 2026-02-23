import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed, successEmbed } from '../../../Shared/src/utils/embed';
import { getQueue, isDJ, getMusicConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue')
    .addIntegerOption((option) =>
      option
        .setName('from')
        .setDescription('Current position of the track (1-indexed)')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('to')
        .setDescription('New position for the track (1-indexed)')
        .setRequired(true)
        .setMinValue(1)
    ),
  module: 'music',
  permissionPath: 'music.move',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.voice.channel) {
      return interaction.reply({
        embeds: [errorEmbed('You must be in a voice channel')],
        ephemeral: true,
      });
    }

    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (!botVoiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed('The bot must be in a voice channel')],
        ephemeral: true,
      });
    }

    if (member.voice.channel.id !== botVoiceChannel.id) {
      return interaction.reply({
        embeds: [errorEmbed('You must be in the same voice channel as the bot')],
        ephemeral: true,
      });
    }

    const config = await getMusicConfig(interaction.guildId!);
    const isUserDJ = isDJ(member, config);
    if (!isUserDJ) {
      return interaction.reply({
        embeds: [errorEmbed('You must be a DJ to use this command')],
        ephemeral: true,
      });
    }

    const queue = getQueue(interaction.guildId!);
    if (!queue || queue.tracks.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('The queue is empty or does not exist')],
        ephemeral: true,
      });
    }

    const fromPosition = interaction.options.getInteger('from', true);
    const toPosition = interaction.options.getInteger('to', true);

    if (fromPosition < 1 || fromPosition > queue.tracks.length) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `Invalid 'from' position. The queue has **${queue.tracks.length}** tracks.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (toPosition < 1 || toPosition > queue.tracks.length) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `Invalid 'to' position. The queue has **${queue.tracks.length}** tracks.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (fromPosition === toPosition) {
      return interaction.reply({
        embeds: [errorEmbed('The "from" and "to" positions must be different')],
        ephemeral: true,
      });
    }

    // Remove track from old position and insert at new position
    const [movedTrack] = queue.tracks.splice(fromPosition - 1, 1);
    queue.tracks.splice(toPosition - 1, 0, movedTrack);

    await interaction.reply({
      embeds: [
        successEmbed(
          'Track Moved',
          `Moved **${movedTrack.title}** by **${movedTrack.author}** from position **${fromPosition}** to position **${toPosition}**`
        ),
      ],
    });
  },
};

export default command;
