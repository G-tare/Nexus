import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getQueue, isDJ, getMusicConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the music queue (current track will keep playing)'),
  module: 'music',
  permissionPath: 'music.clear',
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

    const removedCount = queue.tracks.length;
    queue.tracks = [];

    await interaction.reply(
      v2Payload([
        successContainer(
          'Queue Cleared',
          `Removed **${removedCount}** track${removedCount !== 1 ? 's' : ''} from the queue`
        ),
      ])
    );
  },
};

export default command;
