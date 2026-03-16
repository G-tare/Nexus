import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('cry')
    .setDescription('Cry')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to cry because of (optional)')
    ),
  permissionPath: 'fun.interact.cry',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const gifUrl = await getInteractionGif('cry');

      const description = targetUser
        ? `${interaction.user.username} is crying because of ${targetUser.username}! 😭`
        : `${interaction.user.username} is crying! 😭`;

      const container = moduleContainer('fun');
      addText(container, `### ${description}`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Cry command error:', error);
      await interaction.reply({
        content: 'Failed to execute cry. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
