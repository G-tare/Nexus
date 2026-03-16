import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('fox')
    .setDescription('Get a random fox image'),

  module: 'fun',
  permissionPath: 'fun.random.fox',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const response = await fetch('https://randomfox.ca/floof/');
      const data = (await response.json()) as { image: string };

      if (!data.image) {
        return interaction.reply({
          content: 'Failed to fetch fox image.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const container = moduleContainer('fun');
      addText(container, '### 🦊 Random Fox');
      addMediaGallery(container, [{ url: data.image }]);
      addFooter(container, 'randomfox.ca');

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Fox error:', error);
      await interaction.reply({
        content: 'Failed to fetch fox image.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
