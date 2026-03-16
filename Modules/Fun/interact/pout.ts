import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('pout')
    .setDescription('Pout')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who you\'re pouting at (optional)')
    ),
  permissionPath: 'fun.interact.pout',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const gifUrl = await getInteractionGif('pout');

      const description = targetUser
        ? `${interaction.user.username} is pouting at ${targetUser.username}! 😠`
        : `${interaction.user.username} is pouting! 😠`;

      const container = moduleContainer('fun');
      addText(container, `### ${description}`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Pout command error:', error);
      await interaction.reply({
        content: 'Failed to execute pout. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
