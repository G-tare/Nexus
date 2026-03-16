import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';
import { toggleFilter, getActiveFilterLabels } from './filterEngine';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('lowpass')
    .setDescription('Apply a lowpass filter to smooth out high frequencies'),

  module: 'music',
  permissionPath: 'music.effects.lowpass',
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

    const result = await toggleFilter(interaction.guildId!, 'lowpass');
    if (result.error) {
      await interaction.editReply({
        embeds: [errorEmbed('Error', result.error)],
      });
      return;
    }

    const statusText = result.active ? 'enabled' : 'disabled';
    const embed = successEmbed('Low Pass', `✅ Low pass filter ${statusText}`)
      .setColor(Colors.Music)
      .setFooter({ text: `Active filters: ${getActiveFilterLabels(queue.filters)}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
