import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAllSounds, ensureDefaultSounds, getSoundsByCategory, incrementUseCount } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-random')
    .setDescription('Play a random sound')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Random from specific category')
        .addChoices(
          { name: 'Memes', value: 'memes' },
          { name: 'Windows', value: 'windows' },
          { name: 'Discord', value: 'discord' },
          { name: 'Effects', value: 'effects' }
        )
        .setRequired(false)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.core.random',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const category = interaction.options.getString('category');

      // Ensure default sounds are seeded
      await ensureDefaultSounds(guildId);

      // Get all sounds
      let sounds = await getAllSounds(guildId);

      if (category) {
        sounds = getSoundsByCategory(sounds, category);
      }

      if (sounds.length === 0) {
        const container = moduleContainer('soundboard');
        addText(container, category
          ? `### ❌ No Sounds Available\nNo sounds found in **${category}** category.`
          : '### ❌ No Sounds Available\nNo sounds available.');

        await interaction.editReply(v2Payload([container]));
        return;
      }

      // Pick random sound
      const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

      // Check if user is in voice channel
      const member = interaction.member as GuildMember | null;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        const container = moduleContainer('soundboard');
        addText(container, '### ❌ Not in Voice Channel\nYou must be in a voice channel to play sounds.');

        await interaction.editReply(v2Payload([container]));
        return;
      }

      // Increment use count
      if (randomSound.id) {
        await incrementUseCount(randomSound.id);
      }

      // Show confirmation container
      const container = moduleContainer('soundboard');
      addText(container, `### 🎲 Random Sound\n**${randomSound.name}** is being played in **${voiceChannel.name}**`);
      addFields(container, [
        {
          name: 'Category',
          value: randomSound.category,
          inline: true,
        },
        {
          name: 'Duration',
          value: `${randomSound.duration}s`,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in soundboard random command:', error);
      await interaction.editReply({
        content: 'An error occurred while playing a random sound.',
      });
    }
  },
};

export default command;
