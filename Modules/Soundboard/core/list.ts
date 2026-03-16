import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAllSounds, ensureDefaultSounds, getSoundsByCategory, getCategoryEmoji } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const CATEGORIES = ['memes', 'windows', 'discord', 'effects'];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-list')
    .setDescription('List all available sounds')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Filter by category')
        .addChoices(
          { name: 'Memes', value: 'memes' },
          { name: 'Windows', value: 'windows' },
          { name: 'Discord', value: 'discord' },
          { name: 'Effects', value: 'effects' }
        )
        .setRequired(false)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.core.list',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const filterCategory = interaction.options.getString('category');

      // Ensure default sounds are seeded
      await ensureDefaultSounds(guildId);

      // Get all sounds
      const sounds = await getAllSounds(guildId);

      if (sounds.length === 0) {
        const container = moduleContainer('soundboard');
        addText(container, '### 📻 Soundboard\nNo sounds available yet.');

        await interaction.editReply(v2Payload([container]));
        return;
      }

      const container = moduleContainer('soundboard');
      const fields: any[] = [];

      if (filterCategory) {
        const filtered = getSoundsByCategory(sounds, filterCategory);
        const emoji = getCategoryEmoji(filterCategory);

        addText(container, `### ${emoji} ${filterCategory.toUpperCase()} Sounds\nFound **${filtered.length}** sound(s)`);

        filtered.slice(0, 10).forEach(sound => {
          fields.push({
            name: `\`${sound.name}\``,
            value: `⏱️ ${sound.duration}s • Plays: ${sound.useCount || 0}`,
          });
        });

        if (filtered.length > 10) {
          addText(container, `-# Showing 10 of ${filtered.length} sounds`);
        }
      } else {
        addText(container, `### 📻 Soundboard Sounds\nTotal sounds: **${sounds.length}**`);

        // Group by category
        for (const category of CATEGORIES) {
          const categorySounds = getSoundsByCategory(sounds, category);
          if (categorySounds.length === 0) continue;

          const emoji = getCategoryEmoji(category);
          const soundList = categorySounds.map(s => `\`${s.name}\``).join(', ');

          fields.push({
            name: `${emoji} ${category.toUpperCase()} (${categorySounds.length})`,
            value: soundList,
          });
        }
      }

      if (fields.length > 0) {
        addFields(container, fields);
      }

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in soundboard list command:', error);
      await interaction.editReply({
        content: 'An error occurred while listing sounds.',
      });
    }
  },
};

export default command;
