import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed, successEmbed } from '../../../Shared/src/utils/embed';
import { getQueue, buildQueueEmbed } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View the current music queue')
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Page number to view (default: 1)')
        .setMinValue(1)
    ),
  module: 'music',
  permissionPath: 'music.queue',
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

    const queue = getQueue(interaction.guildId!);
    if (!queue || queue.tracks.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('The queue is empty')],
        ephemeral: true,
      });
    }

    const page = interaction.options.getInteger('page') ?? 1;
    const embed = buildQueueEmbed(queue, page);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
