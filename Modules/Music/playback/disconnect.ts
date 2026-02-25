import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { leaveVC, getConnection } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Disconnect the bot from the voice channel'),

  module: 'music',
  permissionPath: 'music.disconnect',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const connection = getConnection(interaction.guild!.id);
    if (!connection) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setDescription('I\'m not in a voice channel.')
          .setColor(0xff0000)],
      });
    }

    leaveVC(interaction.guild!.id);

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setDescription('Disconnected from voice channel. Queue has been cleared.')
        .setColor(0xe74c3c)],
    });
  },
};

export default command;
