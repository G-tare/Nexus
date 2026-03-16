import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { joinVC, getConnection, createQueue, getQueue } from '../helpers';
import { errorContainer, warningContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel'),

  module: 'music',
  permissionPath: 'music.join',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.guild?.members.cache.get(interaction.user.id);

    if (!member?.voice.channel) {
      return interaction.editReply(
        v2Payload([errorContainer('Not in Voice', 'You must be in a voice channel first.')])
      );
    }

    const voiceChannelId = member.voice.channel.id;

    // Check if already connected
    const existing = getConnection(interaction.guild!.id);
    if (existing) {
      const queue = getQueue(interaction.guild!.id);
      if (queue?.voiceChannelId === voiceChannelId) {
        return interaction.editReply(
          v2Payload([warningContainer('Already Connected', 'I\'m already in your voice channel!')])
        );
      }
    }

    const connection = await joinVC(interaction.guild!, voiceChannelId);
    if (!connection) {
      return interaction.editReply(
        v2Payload([errorContainer('Connection Failed', 'Failed to join your voice channel. Check my permissions.')])
      );
    }

    // Ensure a queue exists
    if (!getQueue(interaction.guild!.id)) {
      createQueue(interaction.guild!.id, interaction.channelId!, voiceChannelId);
    }

    return interaction.editReply(
      v2Payload([successContainer('Joined', `Joined <#${voiceChannelId}>`)])
    );
  },
};

export default command;
