import {  SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed, successEmbed } from '../../../Shared/src/utils/embed';
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
      return interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.voice.channel) {
      return interaction.reply({
        embeds: [errorEmbed('You must be in a voice channel')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (!botVoiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed('The bot must be in a voice channel')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (member.voice.channel.id !== botVoiceChannel.id) {
      return interaction.reply({
        embeds: [errorEmbed('You must be in the same voice channel as the bot')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const config = await getMusicConfig(interaction.guildId!);
    const isUserDJ = isDJ(member, config);
    if (!isUserDJ) {
      return interaction.reply({
        embeds: [errorEmbed('You must be a DJ to use this command')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const queue = getQueue(interaction.guildId!);
    if (!queue || queue.tracks.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('The queue is empty or does not exist')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const removedCount = queue.tracks.length;
    queue.tracks = [];

    await interaction.reply({
      embeds: [
        successEmbed(
          'Queue Cleared',
          `Removed **${removedCount}** track${removedCount !== 1 ? 's' : ''} from the queue`
        ),
      ],
    });
  },
};

export default command;
