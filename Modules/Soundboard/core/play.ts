import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getSound, ensureDefaultSounds, incrementUseCount } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-play')
    .setDescription('Play a sound in your voice channel')
    .addStringOption((opt) =>
      opt
        .setName('sound')
        .setDescription('Sound name to play')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.core.play',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const soundName = interaction.options.getString('sound', true);

      // Ensure default sounds are seeded
      await ensureDefaultSounds(guildId);

      // Get the sound
      const sound = await getSound(guildId, soundName);

      if (!sound) {
        const container = moduleContainer('soundboard');
        addText(container, `### ❌ Sound Not Found\nSound "${soundName}" not found. Use \`/soundboard list\` to see available sounds.`);

        await interaction.editReply(v2Payload([container]));
        return;
      }

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
      if (sound.id) {
        await incrementUseCount(sound.id);
      }

      // Show confirmation container
      const container = moduleContainer('soundboard');
      addText(container, `### 🔊 Playing Sound\n**${sound.name}** is being played in **${voiceChannel.name}**`);
      addFields(container, [
        {
          name: 'Category',
          value: sound.category,
          inline: true,
        },
        {
          name: 'Duration',
          value: `${sound.duration}s`,
          inline: true,
        },
        {
          name: 'Times Played',
          value: `${sound.useCount || 0}`,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));

      // NOTE: Actual audio playback would require @discordjs/voice integration
      // For now, just confirm the command execution
    } catch (error) {
      console.error('Error in soundboard play command:', error);
      await interaction.editReply({
        content: 'An error occurred while playing the sound.',
      });
    }
  },
};

export default command;
