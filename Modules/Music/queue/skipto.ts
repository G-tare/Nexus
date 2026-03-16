import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getQueue, isDJ, getMusicConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('skipto')
    .setDescription('Skip to a specific track position in the queue')
    .addIntegerOption((option) =>
      option
        .setName('position')
        .setDescription('Position to skip to (1-indexed)')
        .setRequired(true)
        .setMinValue(1)
    ),
  module: 'music',
  permissionPath: 'music.skipto',
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

    const position = interaction.options.getInteger('position', true);

    if (position < 1 || position > queue.tracks.length) {
      return interaction.reply(
        v2Payload([errorContainer('Invalid Position', `Invalid position. The queue has **${queue.tracks.length}** tracks.`)])
      );
    }

    // Get the track at the target position
    const targetTrack = queue.tracks[position - 1];

    // Remove all tracks before the target position
    queue.tracks.splice(0, position - 1);

    // TODO: Play the track at this position
    // This would typically involve calling a play function from the queue manager
    // Example: await playTrack(queue, targetTrack);

    await interaction.reply(
      v2Payload([
        successContainer(
          'Skipped to Track',
          `Now playing **${targetTrack.title}** by **${targetTrack.author}** (position **${position}**)`
        ),
      ])
    );
  },
};

export default command;
