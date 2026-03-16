import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { leaveVC, getConnection } from '../helpers';
import { errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
      return interaction.editReply(
        v2Payload([errorContainer('Not Connected', 'I\'m not in a voice channel.')])
      );
    }

    leaveVC(interaction.guild!.id);

    return interaction.editReply(
      v2Payload([errorContainer('Disconnected', 'Disconnected from voice channel. Queue has been cleared.')])
    );
  },
};

export default command;
