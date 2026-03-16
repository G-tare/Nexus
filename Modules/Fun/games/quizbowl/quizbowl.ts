import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, getRandomElement, shuffleArray } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const QUESTIONS = [
  { question: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille', 'Nice'], correct: 0, category: 'Geography' },
  { question: 'What is 2 + 2 × 3?', options: ['8', '12', '6', '10'], correct: 0, category: 'Math' },
  { question: 'Who wrote Romeo and Juliet?', options: ['Shakespeare', 'Marlowe', 'Jonson', 'Bacon'], correct: 0, category: 'Literature' },
  { question: 'What is the largest planet?', options: ['Jupiter', 'Saturn', 'Neptune', 'Mars'], correct: 0, category: 'Science' },
  { question: 'What is the smallest prime number?', options: ['2', '1', '3', '5'], correct: 0, category: 'Math' },
  { question: 'Which country has the most population?', options: ['India', 'China', 'USA', 'Indonesia'], correct: 0, category: 'Geography' },
  { question: 'What is H2O?', options: ['Water', 'Hydrogen', 'Oxygen', 'Salt'], correct: 0, category: 'Science' },
  { question: 'Who painted the Mona Lisa?', options: ['Da Vinci', 'Michelangelo', 'Raphael', 'Donatello'], correct: 0, category: 'Art' },
  { question: 'What year did WWII end?', options: ['1945', '1944', '1946', '1943'], correct: 0, category: 'History' },
  { question: 'What is the speed of light?', options: ['3×10⁸ m/s', '2×10⁸ m/s', '4×10⁸ m/s', '1×10⁸ m/s'], correct: 0, category: 'Physics' },
  { question: 'Which is the deepest ocean?', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], correct: 0, category: 'Geography' },
  { question: 'What is the boiling point of water?', options: ['100°C', '90°C', '110°C', '80°C'], correct: 0, category: 'Chemistry' },
  { question: 'Who invented the telephone?', options: ['Bell', 'Edison', 'Tesla', 'Marconi'], correct: 0, category: 'History' },
  { question: 'What is the smallest country in the world?', options: ['Vatican City', 'Monaco', 'Liechtenstein', 'Malta'], correct: 0, category: 'Geography' },
  { question: 'How many strings does a violin have?', options: ['4', '6', '8', '5'], correct: 0, category: 'Music' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('quizbowl')
    .setDescription('Answer 15 multiple choice questions'),

  module: 'fun',
  permissionPath: 'fun.games.quizbowl',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'quizbowl');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let score = 0;
    const questions = shuffleArray(QUESTIONS).slice(0, 15);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const shuffledOptions = shuffleArray(q.options);
      const correctIndex = shuffledOptions.indexOf(q.options[q.correct]);

      const qContainer = moduleContainer('fun');
      addText(qContainer, `### Question ${i + 1}/15`);
      addText(qContainer, `**${q.question}**`);
      addFields(qContainer, [{ name: 'Category', value: q.category }]);
      addText(qContainer, '-# 20 seconds per question');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`q_a`)
            .setLabel(`A) ${shuffledOptions[0]}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`q_b`)
            .setLabel(`B) ${shuffledOptions[1]}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`q_c`)
            .setLabel(`C) ${shuffledOptions[2]}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`q_d`)
            .setLabel(`D) ${shuffledOptions[3]}`)
            .setStyle(ButtonStyle.Secondary)
        );

      qContainer.addActionRowComponents(row);
      const msg = await interaction.followUp({ ...v2Payload([qContainer]), fetchReply: true });

      try {
        const buttonInteraction = await msg.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          time: 20000,
        });

        const choiceMap: Record<string, number> = { q_a: 0, q_b: 1, q_c: 2, q_d: 3 };
        const chosenIndex = choiceMap[buttonInteraction.customId];

        if (chosenIndex === correctIndex) {
          score++;
          const correctContainer = moduleContainer('fun');
          addText(correctContainer, '✅ Correct!');
          await buttonInteraction.reply(v2Payload([correctContainer]));
        } else {
          const wrongContainer = moduleContainer('fun');
          addText(wrongContainer, `❌ Wrong! Answer was: **${q.options[q.correct]}**`);
          await buttonInteraction.reply(v2Payload([wrongContainer]));
        }

        await interaction.editReply({ components: [] });
      } catch (error) {
        const timeoutContainer = moduleContainer('fun');
        addText(timeoutContainer, `⏱️ Time\'s up! Answer was: **${q.options[q.correct]}**`);
        await interaction.followUp(v2Payload([timeoutContainer]));
      }
    }

    const percentage = Math.round((score / 15) * 100);
    const resultContainer = moduleContainer('fun');
    addText(resultContainer, '### Quiz Bowl Results');
    addFields(resultContainer, [
      { name: 'Score', value: `${score}/15` },
      { name: 'Percentage', value: `${percentage}%` },
    ]);

    await interaction.followUp(v2Payload([resultContainer]));

    await setCooldown(interaction.guildId!, interaction.user.id, 'quizbowl', 3);
  },
} as BotCommand;
