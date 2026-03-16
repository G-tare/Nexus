import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('dance')
    .setDescription('Dance')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to dance with (optional)')
    ),
  permissionPath: 'fun.interact.dance',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const gifUrl = await getInteractionGif('dance');

      const description = targetUser
        ? `${interaction.user.username} is dancing with ${targetUser.username}! 💃`
        : `${interaction.user.username} is dancing! 💃`;

      const container = moduleContainer('fun');
      addText(container, `### ${description}`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Dance command error:', error);
      await interaction.reply({
        content: 'Failed to execute dance. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
