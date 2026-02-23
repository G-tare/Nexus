import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown, emitGameWon } from '../../helpers';


const QUESTIONS = [
  {
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correct: 2,
    category: 'geography',
    difficulty: 'easy',
  },
  {
    question: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correct: 1,
    category: 'science',
    difficulty: 'easy',
  },
  {
    question: 'What is the smallest prime number?',
    options: ['0', '1', '2', '3'],
    correct: 2,
    category: 'science',
    difficulty: 'easy',
  },
  {
    question: 'Who wrote Romeo and Juliet?',
    options: ['Marlowe', 'Shakespeare', 'Bacon', 'Johnson'],
    correct: 1,
    category: 'entertainment',
    difficulty: 'medium',
  },
  {
    question: 'In what year did the Titanic sink?',
    options: ['1912', '1920', '1905', '1898'],
    correct: 0,
    category: 'history',
    difficulty: 'medium',
  },
  {
    question: 'What is the largest ocean on Earth?',
    options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
    correct: 3,
    category: 'geography',
    difficulty: 'easy',
  },
  {
    question: 'Which country has the most Olympic gold medals?',
    options: ['China', 'Russia', 'United States', 'Germany'],
    correct: 2,
    category: 'sports',
    difficulty: 'medium',
  },
  {
    question: 'What is the chemical symbol for Gold?',
    options: ['Go', 'Gd', 'Au', 'Ag'],
    correct: 2,
    category: 'science',
    difficulty: 'medium',
  },
  {
    question: 'How many strings does a violin have?',
    options: ['4', '5', '6', '8'],
    correct: 0,
    category: 'entertainment',
    difficulty: 'hard',
  },
  {
    question: 'What is the speed of light?',
    options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s'],
    correct: 0,
    category: 'science',
    difficulty: 'hard',
  },
];

const DIFFICULTY_REWARDS = {
  easy: 10,
  medium: 25,
  hard: 50,
};

export default {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Answer a trivia question and earn currency!')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Choose a category')
        .setRequired(false)
        .addChoices(
          { name: 'General', value: 'general' },
          { name: 'Science', value: 'science' },
          { name: 'History', value: 'history' },
          { name: 'Geography', value: 'geography' },
          { name: 'Entertainment', value: 'entertainment' },
          { name: 'Sports', value: 'sports' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('difficulty')
        .setDescription('Choose a difficulty')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' }
        )
    ),

  module: 'fun',
  permissionPath: 'fun.games.trivia',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'trivia');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        ephemeral: true,
      });
    }

    const category = interaction.options.getString('category') || 'general';
    const difficulty = (interaction.options.getString('difficulty') || 'easy') as 'easy' | 'medium' | 'hard';

    const filtered = QUESTIONS.filter(
      (q) => q.category === category && q.difficulty === difficulty
    );
    const question = filtered[Math.floor(Math.random() * filtered.length)] || QUESTIONS[0];

    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(question.options[question.correct]);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_a_${correctIndex === 0 ? 'correct' : 'wrong'}`)
        .setLabel('A')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trivia_b_${correctIndex === 1 ? 'correct' : 'wrong'}`)
        .setLabel('B')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trivia_c_${correctIndex === 2 ? 'correct' : 'wrong'}`)
        .setLabel('C')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trivia_d_${correctIndex === 3 ? 'correct' : 'wrong'}`)
        .setLabel('D')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🧠 Trivia Question')
      .setDescription(question.question)
      .addFields(
        { name: 'A)', value: shuffledOptions[0], inline: false },
        { name: 'B)', value: shuffledOptions[1], inline: false },
        { name: 'C)', value: shuffledOptions[2], inline: false },
        { name: 'D)', value: shuffledOptions[3], inline: false }
      )
      .addFields({
        name: 'Difficulty',
        value: difficulty.toUpperCase(),
        inline: true,
      })
      .addFields({
        name: 'Reward',
        value: `+${DIFFICULTY_REWARDS[difficulty as keyof typeof DIFFICULTY_REWARDS]}`,
        inline: true,
      });

    const message = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 30000,
    });

    let answered = false;

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: '❌ This is not your game!',
          ephemeral: true,
        });
      }

      if (answered) {
        return buttonInteraction.reply({
          content: '❌ You already answered!',
          ephemeral: true,
        });
      }

      answered = true;
      const isCorrect = buttonInteraction.customId.includes('correct');

      if (isCorrect) {
        const reward =
          DIFFICULTY_REWARDS[difficulty as keyof typeof DIFFICULTY_REWARDS];
        emitGameWon(
          interaction.guildId!,
          interaction.user.id,
          'trivia',
          0,
          reward
        );

        const resultEmbed = new EmbedBuilder()
          .setTitle('✅ Correct!')
          .setDescription(`You earned **${reward}** currency!`)
          .setColor(0x00ff00);

        await buttonInteraction.update({
          embeds: [resultEmbed],
          components: [],
        });
      } else {
        const resultEmbed = new EmbedBuilder()
          .setTitle('❌ Wrong!')
          .setDescription(`The correct answer was **${question.options[question.correct]}**`)
          .setColor(0xff0000);

        await buttonInteraction.update({
          embeds: [resultEmbed],
          components: [],
        });
      }

      collector.stop();
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        interaction.editReply({
          content: '⏱️ Time\'s up! The correct answer was: **' +
            question.options[question.correct] + '**',
          components: [],
        });
      }
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'trivia', 5);
  },
  category: 'fun',
} as BotCommand;
