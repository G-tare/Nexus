import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';
import { clearAllFilters } from './filterEngine';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('clearfilter')
    .setDescription('Reset all applied audio filters to default'),

  module: 'music',
  permissionPath: 'music.effects.clearfilter',
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

    const result = await clearAllFilters(interaction.guildId!);
    if (result.error) {
      await interaction.editReply({
        embeds: [errorEmbed('Error', result.error)],
      });
      return;
    }

    const embed = successEmbed('Filters Cleared', '✅ All audio filters have been reset to default')
      .setColor(Colors.Music);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
