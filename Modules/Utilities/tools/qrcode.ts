import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('qrcode')
    .setDescription('Generate a QR code')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Text to encode in QR code')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.qrcode',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const text = interaction.options.getString('text', true);
      const encodedText = encodeURIComponent(text);

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodedText}&size=300x300`;

      const container = moduleContainer('utilities');
      addText(container, `### 📱 QR Code\nQR Code for: \`${text}\``);
      addMediaGallery(container, [{ url: qrUrl, description: 'Generated QR Code' }]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in qrcode command:', error);
      await interaction.editReply({
        content: 'An error occurred while generating the QR code.',
      });
    }
  },
};

export default command;
