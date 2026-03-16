import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const jokes = {
  dad: [
    { setup: 'Why don\'t scientists trust atoms?', punchline: 'Because they make up everything!' },
    { setup: 'Did you hear about the claustrophobic astronaut?', punchline: 'He just needed a little space!' },
    { setup: 'What do you call a fake noodle?', punchline: 'An impasta!' },
    { setup: 'Why did the scarecrow win an award?', punchline: 'Because he was outstanding in his field!' },
    { setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!' }
  ],
  programming: [
    { setup: 'Why do Java developers wear glasses?', punchline: 'Because they don\'t C#!' },
    { setup: 'How many programmers does it take to change a light bulb?', punchline: 'None, that\'s a hardware problem!' },
    { setup: 'Why do programmers prefer dark mode?', punchline: 'Because light attracts bugs!' },
    { setup: 'What\'s a programmer\'s favorite hangout place?', punchline: 'Foo Bar!' },
    { setup: 'Why did the developer go broke?', punchline: 'Because he used up all his cache!' }
  ],
  general: [
    { setup: 'What do you call a sleeping bull?', punchline: 'A bulldozer!' },
    { setup: 'Why don\'t eggs tell jokes?', punchline: 'They\'d crack each other up!' },
    { setup: 'What did one ocean say to the other ocean?', punchline: 'Nothing, they just waved!' },
    { setup: 'Why did the student do multiplication problems on the floor?', punchline: 'The teacher told them not to use tables!' },
    { setup: 'What do you call an alligator in a vest?', punchline: 'An investigator!' },
    { setup: 'Why don\'t skeletons fight each other?', punchline: 'They don\'t have the guts!' },
    { setup: 'What do you call a boomerang that doesn\'t come back?', punchline: 'A stick!' },
    { setup: 'Why did the math book look so sad?', punchline: 'Because it had too many problems!' },
    { setup: 'What do you call a dinosaur that crashes his car?', punchline: 'Tyrannosaurus Wrecks!' },
    { setup: 'Why did the cookie go to the doctor?', punchline: 'Because it felt crumbly!' },
    { setup: 'What do you call a pig that does karate?', punchline: 'A pork chop!' },
    { setup: 'Why did the bicycle fall over?', punchline: 'Because it was two-tired!' }
  ]
};

type JokeCategory = keyof typeof jokes;

export default {
  module: 'fun',
  category: 'fun',
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a random joke')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Joke category')
        .addChoices(
          { name: 'Dad Jokes', value: 'dad' },
          { name: 'Programming', value: 'programming' },
          { name: 'General', value: 'general' }
        )
    ),
  permissionPath: 'fun.random.joke',
  premiumFeature: 'fun.basic',

  async execute(interaction) {
    try {
      // TODO: Implement actual API fetch from joke API
      // const category = interaction.options.getString('category') || 'general';
      // const response = await fetch(`https://api.example.com/jokes?category=${category}`);
      // const data = await response.json();

      const category = (interaction.options.getString('category') || 'general') as JokeCategory;
      const jokeArray = jokes[category];
      const joke = jokeArray[Math.floor(Math.random() * jokeArray.length)];

      const container = moduleContainer('fun');
      addText(container, `### 😂 ${joke.setup}`);
      addText(container, `||${joke.punchline}||`);
      addFooter(container, `Category: ${category}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Joke command error:', error);
      await interaction.reply({
        content: 'Failed to fetch joke. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
} as BotCommand;
