import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const RADIO_STATIONS = [
  { name: 'Lofi Hip Hop', value: 'lofi' },
  { name: 'Smooth Jazz', value: 'jazz' },
  { name: 'Classical', value: 'classical' },
  { name: 'Classic Rock', value: 'rock' },
  { name: 'Top Hits', value: 'pop' },
  { name: 'Ambient/Chill', value: 'ambient' },
  { name: 'Electronic', value: 'edm' },
];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('radio-list')
    .setDescription('List all available radio stations'),

  module: 'music',
  permissionPath: 'music.radio.list',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const container = moduleContainer('music');
      addText(container, '### 📻 Available Radio Stations\nUse `/radio-play` to start streaming');

      const fields = RADIO_STATIONS.map((station, index) => ({
        name: `${index + 1}. ${station.name}`,
        value: `\`/radio-play ${station.value}\``,
        inline: false,
      }));

      addFields(container, fields);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in radio list command:', error);
      await interaction.editReply({
        content: 'An error occurred while listing radio stations.',
      });
    }
  },
};

export default command;
