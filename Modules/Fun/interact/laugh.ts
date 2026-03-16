import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('laugh')
    .setDescription('Laugh at someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to laugh at')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.laugh',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);
      const gifUrl = await getInteractionGif('laugh');

      const container = moduleContainer('fun');
      addText(container, `### ${interaction.user.username} laughed at ${targetUser.username}! 😂`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Laugh command error:', error);
      await interaction.reply({
        content: 'Failed to execute laugh. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
