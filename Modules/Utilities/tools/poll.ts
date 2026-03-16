import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('utilities-quickpoll')
    .setDescription('Create a quick poll with reaction buttons')
    .addStringOption((opt) =>
      opt
        .setName('question')
        .setDescription('Poll question')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('option1')
        .setDescription('First option')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('option2')
        .setDescription('Second option')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('option3')
        .setDescription('Third option')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('option4')
        .setDescription('Fourth option')
        .setRequired(false)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.poll',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const question = interaction.options.getString('question', true);
      const opt1 = interaction.options.getString('option1', true);
      const opt2 = interaction.options.getString('option2', true);
      const opt3 = interaction.options.getString('option3');
      const opt4 = interaction.options.getString('option4');

      const options = [opt1, opt2, ...(opt3 ? [opt3] : []), ...(opt4 ? [opt4] : [])];

      if (options.length < 2) {
        await interaction.editReply({
          content: '❌ You need at least 2 options for a poll.',
        });
        return;
      }

      if (options.length > 4) {
        await interaction.editReply({
          content: '❌ Maximum 4 options allowed for a poll.',
        });
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, '### 📊 Poll');
      addText(container, question);
      addSeparator(container, 'small');

      const optionLines = options.map((option, index) =>
        `${POLL_EMOJIS[index]} **Option ${index + 1}:** ${option}`
      );
      addText(container, optionLines.join('\n'));
      addText(container, '-# React to vote!');

      const message = await interaction.editReply(v2Payload([container]));

      // Add reactions
      for (let i = 0; i < options.length; i++) {
        await message.react(POLL_EMOJIS[i]).catch(console.error);
      }
    } catch (error) {
      console.error('Error in poll command:', error);
      await interaction.editReply({
        content: 'An error occurred while creating the poll.',
      });
    }
  },
};

export default command;
