import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
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
      return interaction.reply(v2Payload([errorContainer('Server Only', 'This command can only be used in a server.')]));
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.voice.channel) {
      return interaction.reply(v2Payload([errorContainer('Not in Voice', 'You must be in a voice channel.')]));
    }

    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (!botVoiceChannel) {
      return interaction.reply(v2Payload([errorContainer('Bot Not in Voice', 'The bot must be in a voice channel.')]));
    }

    if (member.voice.channel.id !== botVoiceChannel.id) {
      return interaction.reply(v2Payload([errorContainer('Wrong Voice Channel', 'You must be in the same voice channel as the bot.')]));
    }

    const config = await getMusicConfig(interaction.guildId!);
    const isUserDJ = isDJ(member, config);
    if (!isUserDJ) {
      return interaction.reply(v2Payload([errorContainer('DJ Required', 'You must be a DJ to use this command.')]));
    }

    const queue = getQueue(interaction.guildId!);
    if (!queue || queue.tracks.length === 0) {
      return interaction.reply(v2Payload([errorContainer('Queue Empty', 'The queue is empty or does not exist.')]));
    }

    const fromPosition = interaction.options.getInteger('from', true);
    const toPosition = interaction.options.getInteger('to', true);

    if (fromPosition < 1 || fromPosition > queue.tracks.length) {
      return interaction.reply(
        v2Payload([errorContainer('Invalid Position', `Invalid 'from' position. The queue has **${queue.tracks.length}** tracks.`)])
      );
    }

    if (toPosition < 1 || toPosition > queue.tracks.length) {
      return interaction.reply(
        v2Payload([errorContainer('Invalid Position', `Invalid 'to' position. The queue has **${queue.tracks.length}** tracks.`)])
      );
    }

    if (fromPosition === toPosition) {
      return interaction.reply(
        v2Payload([errorContainer('Same Position', 'The "from" and "to" positions must be different.')])
      );
    }

    // Remove track from old position and insert at new position
    const [movedTrack] = queue.tracks.splice(fromPosition - 1, 1);
    queue.tracks.splice(toPosition - 1, 0, movedTrack);

    await interaction.reply(
      v2Payload([
        successContainer(
          'Track Moved',
          `Moved **${movedTrack.title}** by **${movedTrack.author}** from position **${fromPosition}** to position **${toPosition}**`
        ),
      ])
    );
  },
};

export default command;
