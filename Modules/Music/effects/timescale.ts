import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';
import { setCustomFilter, getActiveFilterLabels, applyFilters } from './filterEngine';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('timescale')
    .setDescription('Adjust speed, pitch, and rate together')
    .addNumberOption((opt) =>
      opt
        .setName('speed')
        .setDescription('Playback speed (0.1-3.0, default 1.0)')
        .setMinValue(0.1)
        .setMaxValue(3.0)
        .setRequired(false)
    )
    .addNumberOption((opt) =>
      opt
        .setName('pitch')
        .setDescription('Pitch adjustment (0.1-3.0, default 1.0)')
        .setMinValue(0.1)
        .setMaxValue(3.0)
        .setRequired(false)
    )
    .addNumberOption((opt) =>
      opt
        .setName('rate')
        .setDescription('Rate adjustment (0.1-3.0, default 1.0)')
        .setMinValue(0.1)
        .setMaxValue(3.0)
        .setRequired(false)
    ),

  module: 'music',
  permissionPath: 'music.effects.timescale',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.editReply({
        embeds: [errorEmbed('Not Connected', 'You must be in a voice channel.')],
      });
      return;
    }

    const queue = getQueue(interaction.guildId!);
    if (!queue || !queue.currentTrack) {
      await interaction.editReply({
        embeds: [errorEmbed('Nothing Playing', 'There is no music playing right now.')],
      });
      return;
    }

    const speed = interaction.options.getNumber('speed') ?? 1.0;
    const pitch = interaction.options.getNumber('pitch') ?? 1.0;
    const rate = interaction.options.getNumber('rate') ?? 1.0;

    // If all values are default (1.0), remove the timescale filter
    if (speed === 1.0 && pitch === 1.0 && rate === 1.0) {
      queue.filters = queue.filters.filter(
        (f) => !f.startsWith('custom:') || !f.includes(':timescale')
      );
      await applyFilters(interaction.guildId!);

      const embed = successEmbed('Timescale', '✅ Timescale filter removed')
        .setColor(Colors.Music)
        .setFooter({ text: `Active filters: ${getActiveFilterLabels(queue.filters)}` });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Set custom timescale filter
    const result = await setCustomFilter(interaction.guildId!, 'timescale', {
      timescale: { speed, pitch, rate },
    });

    if (result.error) {
      await interaction.editReply({
        embeds: [errorEmbed('Error', result.error)],
      });
      return;
    }

    const embed = successEmbed(
      'Timescale',
      `✅ Timescale adjusted:\n• Speed: ${speed.toFixed(2)}\n• Pitch: ${pitch.toFixed(2)}\n• Rate: ${rate.toFixed(2)}`
    )
      .setColor(Colors.Music)
      .setFooter({ text: `Active filters: ${getActiveFilterLabels(queue.filters)}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
