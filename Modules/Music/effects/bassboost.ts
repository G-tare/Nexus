import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue } from '../helpers';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';
import { toggleFilter, getActiveFilterLabels } from './filterEngine';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('bassboost')
    .setDescription('Enhance the low frequencies for deeper bass')
    .addStringOption((opt) =>
      opt
        .setName('intensity')
        .setDescription('Bass boost intensity level')
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        )
        .setRequired(true)
    ),

  module: 'music',
  permissionPath: 'music.effects.bassboost',
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

    const intensity = interaction.options.getString('intensity', true);
    const filterName = `bassboost_${intensity}`;

    // Remove any existing bassboost_* filters
    queue.filters = queue.filters.filter((f) => !f.startsWith('bassboost_'));

    // Check if we're toggling off (same intensity already active logic handled via toggle)
    const idx = queue.filters.indexOf(filterName);
    if (idx > -1) {
      queue.filters.splice(idx, 1);
    } else {
      queue.filters.push(filterName);
    }

    // Apply the filters via filterEngine's applyFilters
    const { applyFilters } = await import('./filterEngine');
    await applyFilters(interaction.guildId!);

    const isActive = queue.filters.includes(filterName);
    const statusText = isActive ? 'enabled' : 'disabled';
    const intensityLabel = intensity.charAt(0).toUpperCase() + intensity.slice(1);

    const embed = successEmbed(
      'Bass Boost',
      `✅ Bass Boost (${intensityLabel}) ${statusText}`
    )
      .setColor(Colors.Music)
      .setFooter({ text: `Active filters: ${getActiveFilterLabels(queue.filters)}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
