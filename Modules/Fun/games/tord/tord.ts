import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, getRandomElement } from '../../helpers';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const TRUTHS = [
  'What is your biggest fear?',
  'Have you ever lied to your best friend?',
  'What is your most embarrassing moment?',
  'Who do you have a crush on?',
  'What is something you\'re ashamed of?',
  'What is your deepest secret?',
  'Would you ever cheat on someone?',
  'What is the worst thing you\'ve done?',
  'Have you ever stolen anything?',
  'What do you think about me?',
  'What is your biggest insecurity?',
  'Have you ever been jealous of a friend?',
  'What is your worst habit?',
  'Would you take back something you said?',
  'Have you cried this week?',
  'What is the rudest thing you\'ve thought about someone?',
  'Have you ever talked about someone behind their back?',
  'What is something you regret?',
  'Have you ever fantasized about someone?',
  'Would you change anything about yourself?',
  'What is your biggest pet peeve?',
  'Have you ever been mean to someone on purpose?',
  'What is something you\'ve never told anyone?',
  'Do you think you\'re a good friend?',
  'What is the most awkward thing that\'s happened to you?',
  'Have you ever been in love?',
  'What\'s the longest you\'ve gone without a shower?',
  'Do you think you\'re attractive?',
  'What is something you\'ve lied about?',
  'Have you ever ignored someone on purpose?',
  'What is your most unpopular opinion?',
  'Have you ever been attracted to a friend?',
  'What is something people don\'t know about you?',
  'Have you ever cried over a movie?',
  'What is your biggest weakness?',
  'Would you ever date someone much older/younger?',
  'Have you ever used someone?',
  'What is something you\'d never tell your parents?',
  'Do you think you\'re a better friend than most people?',
  'Have you ever been in an accident?',
];

const DARES_CLEAN = [
  'Do your best impression of someone here.',
  'Sing a song out loud.',
  'Do 20 push-ups.',
  'Speak in an accent for the next 3 rounds.',
  'Tell a joke.',
  'Laugh without stopping for 10 seconds.',
  'Dance for 30 seconds.',
  'Yell out the first word that comes to your mind.',
  'Imitate an animal for 1 minute.',
  'Do a cartwheel or attempt one.',
  'Make a funny face for a photo.',
  'Recite the alphabet backwards.',
  'Try to lick your elbow.',
  'Do 10 jumping jacks.',
  'Say something nice about everyone here.',
  'Spin around 10 times and walk straight.',
  'Hum the theme to a TV show.',
  'Give someone a piggyback ride.',
  'Juggle (or try to).',
  'Walk like a crab for 1 minute.',
];

const DARES_SPICY = [
  'Kiss the person to your left on the cheek.',
  'Let someone else post a tweet/story as you.',
  'Smell someone\'s armpit.',
  'Allow someone to draw on your face with marker.',
  'Post an embarrassing photo on social media.',
  'Eat something unusual from the fridge.',
  'Do a striptease (keep your underwear on).',
  'Text your crush and tell them what you think.',
  'Go outside and yell something embarrassing.',
  'Have someone write a funny story about you online.',
  'Let someone wax a small part of your body.',
  'Eat a spoonful of condiment of someone\'s choosing.',
  'Pretend to propose to someone in the room.',
  'Let someone mess with your appearance (hair, makeup, etc).',
  'Call a random number and sing to them.',
  'Ask someone to be your fake boyfriend/girlfriend.',
  'Let someone choose what you wear tomorrow.',
  'Confess something you\'ve been holding back.',
];

const DARES_EXTREME = [
  'Shave a part of your body (eyebrow, leg, etc).',
  'Get a temporary tattoo of someone\'s choosing.',
  'Dye a streak of your hair.',
  'Eat something spicy and don\'t drink water for 1 minute.',
  'Let someone pierce you (ears only).',
  'Streak through the room.',
  'Drink something unpleasant.',
  'Get someone\'s name or initials written on you.',
  'Eat food using only your mouth (no hands).',
  'Let someone give you a makeover.',
  'Shave something other than legs.',
  'Go to a store and return something without a receipt and act confused.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('tord')
    .setDescription('Play Truth or Dare'),

  module: 'fun',
  permissionPath: 'fun.games.tord',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'tord');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let difficulty = '';
    let truth: string = '';
    let dare: string = '';

    const difficultyRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('clean')
          .setLabel('Clean')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('spicy')
          .setLabel('Spicy')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('extreme')
          .setLabel('Extreme')
          .setStyle(ButtonStyle.Danger)
      );

    const container = moduleContainer('fun');
    addText(container, '### Truth or Dare');
    addText(container, 'Choose a difficulty level:');
    container.addActionRowComponents(difficultyRow);

    try {
      const replyMessage = await interaction.reply({ ...v2Payload([container]), fetchReply: true });

      const difficultyButton = await replyMessage.awaitMessageComponent({
        time: 30000,
        filter: (i) => i.user.id === interaction.user.id,
      }) as ButtonInteraction;

      if (!difficultyButton) {
        await setCooldown(interaction.guildId!, interaction.user.id, 'tord', 3);
        return;
      }

      difficulty = difficultyButton.customId;

      const truthOrDareRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('truth')
            .setLabel('🤔 Truth')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('dare')
            .setLabel('😈 Dare')
            .setStyle(ButtonStyle.Danger)
        );

      const diffContainer = moduleContainer('fun');
      addText(diffContainer, `### Truth or Dare - ${difficulty.toUpperCase()}`);
      addText(diffContainer, 'Choose Truth or Dare:');
      diffContainer.addActionRowComponents(truthOrDareRow);

      await difficultyButton.update(v2Payload([diffContainer]));

      const choice = await replyMessage.awaitMessageComponent({
        time: 30000,
        filter: (i) => i.user.id === interaction.user.id,
      }) as ButtonInteraction;

      if (!choice) {
        await setCooldown(interaction.guildId!, interaction.user.id, 'tord', 3);
        return;
      }

      if (choice.customId === 'truth') {
        truth = getRandomElement(TRUTHS);
      } else {
        if (difficulty === 'clean') {
          dare = getRandomElement(DARES_CLEAN);
        } else if (difficulty === 'spicy') {
          dare = getRandomElement(DARES_SPICY);
        } else {
          dare = getRandomElement(DARES_EXTREME);
        }
      }

      const resultContainer = moduleContainer('fun');
      addText(resultContainer, choice.customId === 'truth' ? '### 🤔 Truth' : '### 😈 Dare');
      addText(resultContainer, choice.customId === 'truth' ? truth : dare);

      await choice.update(v2Payload([resultContainer]));
    } catch (error) {
      console.error('Truth or Dare error:', error);
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'tord', 3);
  },
} as BotCommand;
