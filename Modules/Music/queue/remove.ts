import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed, successEmbed } from '../../../Shared/src/utils/embed';
import { getQueue, isDJ, getMusicConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by position')
    .addIntegerOption((option) =>
      option
        .setName('position')
        .setDescription('Position of the track to remove (1-indexed)')
        .setRequired(true)
        .setMinValue(1)
    ),
  module: 'music',
  permissionPath: 'music.remove',
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

    const position = interaction.options.getInteger('position', true);
    if (position < 1 || position > queue.tracks.length) {
      return interaction.reply({
        embeds: [errorEmbed(`Position must be between 1 and ${queue.tracks.length}`)],
        ephemeral: true,
      });
    }

    const removedTrack = queue.tracks.splice(position - 1, 1)[0];

    await interaction.reply({
      embeds: [
        successEmbed(
          'Track Removed',
          `Removed **${removedTrack.title}** by ${removedTrack.author} from position ${position}`
        ),
      ],
    });
  },
};

export default command;
