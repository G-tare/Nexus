import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('poke')
    .setDescription('Poke someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to poke')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.poke',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);
      const gifUrl = await getInteractionGif('poke');

      const container = moduleContainer('fun');
      addText(container, `### ${interaction.user.username} poked ${targetUser.username}! 👉`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Poke command error:', error);
      await interaction.reply({
        content: 'Failed to execute poke. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
