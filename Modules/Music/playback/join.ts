import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { joinVC, getConnection, createQueue, getQueue } from '../helpers';

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
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setDescription('You must be in a voice channel first.')
          .setColor(0xff0000)],
      });
    }

    const voiceChannelId = member.voice.channel.id;

    // Check if already connected
    const existing = getConnection(interaction.guild!.id);
    if (existing) {
      const queue = getQueue(interaction.guild!.id);
      if (queue?.voiceChannelId === voiceChannelId) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setDescription('I\'m already in your voice channel!')
            .setColor(0xf39c12)],
        });
      }
    }

    const connection = await joinVC(interaction.guild!, voiceChannelId);
    if (!connection) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setDescription('Failed to join your voice channel. Check my permissions.')
          .setColor(0xff0000)],
      });
    }

    // Ensure a queue exists
    if (!getQueue(interaction.guild!.id)) {
      createQueue(interaction.guild!.id, interaction.channelId!, voiceChannelId);
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setDescription(`Joined <#${voiceChannelId}>`)
        .setColor(0x2ecc71)],
    });
  },
};

export default command;
