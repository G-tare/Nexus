import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { getRandomElement } from '../../helpers';

const FAKE_DATA = [
  'browser history: 847 cat videos',
  'favorite food: pizza (extra cheese)',
  'most googled: how to fix stuff I broke',
  'secret hobby: collecting rubber ducks',
  'biggest fear: running out of coffee',
  'hidden talent: making terrible puns',
  'browser cookies: 50GB of memes',
  'saved passwords: password123',
  'search history: very embarrassing',
  'Discord DMs: full of inside jokes',
  'screen time: way too much',
  'hidden folder: anime recommendations',
  'last search: how to be less awkward',
  'saved passwords: hunter2hunter2',
  'browser extensions: 47 ad blockers',
];

export default {
  data: new SlashCommandBuilder()
    .setName('hack')
    .setDescription('Fake hack someone (for fun!)')
    .addUserOption((option) =>
      option.setName('user').setDescription('Who to hack').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.hack',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const target = interaction.options.getUser('user', true);

      const stages = [
        `Accessing ${target.username}'s mainframe...`,
        `Bypassing firewall... [▓▓▓░░░░░] 38%`,
        `Downloading personal data... [▓▓▓▓▓▓░░] 75%`,
        `Decrypting files... [▓▓▓▓▓▓▓▓] 100%`,
        `Hack complete! Found: ${getRandomElement(FAKE_DATA)}`,
      ];

      const msg = await interaction.reply({
        content: stages[0],
        fetchReply: true,
      });

      for (let i = 1; i < stages.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await msg.edit({ content: stages[i] });
      }
    } catch (error) {
      console.error('Hack error:', error);
      await interaction.reply({
        content: 'Failed to hack.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
