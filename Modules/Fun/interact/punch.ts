import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addMediaGallery, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getInteractionGif } from './gifProvider';

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('punch')
    .setDescription('Punch someone')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Who to punch')
        .setRequired(true)
    ),
  permissionPath: 'fun.interact.punch',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user', true);
      const gifUrl = await getInteractionGif('punch');

      const container = moduleContainer('fun');
      addText(container, `### ${interaction.user.username} punched ${targetUser.username}! 👊`);
      addMediaGallery(container, [{ url: gifUrl }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Punch command error:', error);
      await interaction.reply({
        content: 'Failed to execute punch. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
