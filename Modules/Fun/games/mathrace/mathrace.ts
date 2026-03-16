import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const generateProblem = (round: number) => {
  if (round <= 3) {
    const a = Math.floor(Math.random() * 50) + 10;
    const b = Math.floor(Math.random() * 50) + 10;
    return { question: `${a} + ${b}`, answer: a + b };
  } else if (round <= 6) {
    const a = Math.floor(Math.random() * 30) + 10;
    const b = Math.floor(Math.random() * 30);
    return { question: `${a} × ${b}`, answer: a * b };
  } else {
    const problems = [
      { question: 'What is √144?', answer: 12 },
      { question: 'What is 25% of 480?', answer: 120 },
      { question: '17 × 23', answer: 391 },
      { question: '99 ÷ 9', answer: 11 },
      { question: 'What is √256?', answer: 16 },
    ];
    return problems[Math.floor(Math.random() * problems.length)];
  }
};

export default {
  data: new SlashCommandBuilder()
    .setName('mathrace')
    .setDescription('Solve 10 math problems fast'),

  module: 'fun',
  permissionPath: 'fun.games.mathrace',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'mathrace');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let correct = 0;
    let startTime = Date.now();

    const container = moduleContainer('fun');
    addText(container, '### Math Race - 10 Questions');
    addText(container, 'Solve math problems as fast as you can!\n\nProblem 1/10');

    await interaction.reply(v2Payload([container]));

    for (let i = 1; i <= 10; i++) {
      const problem = generateProblem(i);

      const problemContainer = moduleContainer('fun');
      addText(problemContainer, `### Problem ${i}/10`);
      addText(problemContainer, `**${problem.question}**\n\n-# Type your answer in the chat`);

      await interaction.followUp(v2Payload([problemContainer]));

      try {
        const filter = (m: any) => m.author.id === interaction.user.id;
        const collected = await (interaction.channel as TextChannel).awaitMessages({
          filter,
          max: 1,
          time: 15000,
        });

        if (collected.size === 0) {
          const timeoutContainer = moduleContainer('fun');
          addText(timeoutContainer, '⏱️ Time\'s up for this problem!');
          await interaction.followUp(v2Payload([timeoutContainer]));
        } else {
          const answer = parseInt(collected.first()!.content);
          if (answer === problem.answer) {
            correct++;
            const correctContainer = moduleContainer('fun');
            addText(correctContainer, '✅ Correct!');
            await interaction.followUp(v2Payload([correctContainer]));
          } else {
            const incorrectContainer = moduleContainer('fun');
            addText(incorrectContainer, `❌ Wrong! Answer was ${problem.answer}`);
            await interaction.followUp(v2Payload([incorrectContainer]));
          }
        }
      } catch (error) {
        console.error('Math Race error:', error);
      }
    }

    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
    const percentage = Math.round((correct / 10) * 100);

    const resultContainer = moduleContainer('fun');
    addText(resultContainer, '### Math Race Results');
    addFields(resultContainer, [
      { name: 'Score', value: `${correct}/10` },
      { name: 'Percentage', value: `${percentage}%` },
      { name: 'Time', value: `${timeTaken}s` },
    ]);

    await interaction.followUp(v2Payload([resultContainer]));

    await setCooldown(interaction.guildId!, interaction.user.id, 'mathrace', 3);
  },
} as BotCommand;
