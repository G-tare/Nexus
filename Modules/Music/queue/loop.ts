import {  SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed, successEmbed } from '../../../Shared/src/utils/embed';
import { getQueue } from '../helpers';

const LOOP_EMOJIS: Record<string, string> = {
  off: '➡️',
  track: '🔂',
  queue: '🔁',
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode for the queue')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode to set')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track (repeat current)', value: 'track' },
          { name: 'Queue (repeat all)', value: 'queue' }
        )
    ),
  module: 'music',
  permissionPath: 'music.loop',
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

    const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';

    const queue = getQueue(interaction.guildId!);
    if (!queue) {
      return interaction.reply({
        embeds: [errorEmbed('No active queue in this server')],
        flags: MessageFlags.Ephemeral,
      });
    }

    queue.loop = mode;

    await interaction.reply({
      embeds: [
        successEmbed(
          'Loop Mode Updated',
          `Loop mode is now set to **${mode}** ${LOOP_EMOJIS[mode]}`
        ),
      ],
    });
  },
};

export default command;
