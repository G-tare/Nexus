import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getQueue, formatDuration, buildNowPlayingContainer } from '../helpers';
import { errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track with progress bar'),

  module: 'music',
  permissionPath: 'music.nowplaying',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const queue = getQueue(interaction.guild!.id);

    // Check if there's an active queue
    if (!queue || queue.currentTrack === null) {
      return interaction.editReply(
        v2Payload([errorContainer('No Music Playing', 'There is no music currently playing.')])
      );
    }

    // Build the now playing container
    const container = buildNowPlayingContainer(queue.currentTrack, queue);

    // Build action row with buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_pause_resume')
        .setLabel(queue.paused ? 'Resume' : 'Pause')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(queue.paused ? '▶️' : '⏸️'),
      new ButtonBuilder()
        .setCustomId('btn_skip')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏭️'),
      new ButtonBuilder()
        .setCustomId('btn_stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️'),
      new ButtonBuilder()
        .setCustomId('btn_loop')
        .setLabel(
          queue.loop === 'off'
            ? 'Loop Off'
            : queue.loop === 'queue'
              ? 'Loop Queue'
              : 'Loop Track'
        )
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁')
    );

    // Add buttons to container
    container.addActionRowComponents(row);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
