import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('kick-fun')
    .setDescription('Kick someone (for fun)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to kick')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.kick',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);
      const gifUrl = await getInteractionGif('kick');

      const container = moduleContainer('fun');
      addText(container, `### ${interaction.user.username} kicked ${targetUser.username}! 🦵`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Kick command error:', error);
      await interaction.reply({
        content: 'Failed to execute kick. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
