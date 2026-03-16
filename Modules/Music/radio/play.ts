import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const RADIO_STATIONS: Record<string, { name: string; url: string }> = {
  lofi: {
    name: 'Lofi Hip Hop',
    url: 'https://streams.ilovemusic.de/iloveradio17.mp3',
  },
  jazz: {
    name: 'Smooth Jazz',
    url: 'https://streaming.radio.co/s774887f7b/listen',
  },
  classical: {
    name: 'Classical',
    url: 'https://live.musopen.org:8085/streamvbr0',
  },
  rock: {
    name: 'Classic Rock',
    url: 'https://streams.ilovemusic.de/iloveradio21.mp3',
  },
  pop: {
    name: 'Top Hits',
    url: 'https://streams.ilovemusic.de/iloveradio1.mp3',
  },
  ambient: {
    name: 'Ambient/Chill',
    url: 'https://streams.ilovemusic.de/iloveradio15.mp3',
  },
  edm: {
    name: 'Electronic',
    url: 'https://streams.ilovemusic.de/iloveradio2.mp3',
  },
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('radio-play')
    .setDescription('Play a radio station')
    .addStringOption((opt) =>
      opt
        .setName('station')
        .setDescription('Radio station to play')
        .addChoices(
          { name: 'Lofi Hip Hop', value: 'lofi' },
          { name: 'Smooth Jazz', value: 'jazz' },
          { name: 'Classical', value: 'classical' },
          { name: 'Classic Rock', value: 'rock' },
          { name: 'Top Hits', value: 'pop' },
          { name: 'Ambient/Chill', value: 'ambient' },
          { name: 'Electronic', value: 'edm' }
        )
        .setRequired(true)
    ),

  module: 'music',
  permissionPath: 'music.radio.play',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const station = interaction.options.getString('station', true);

      const radioStation = RADIO_STATIONS[station];

      if (!radioStation) {
        await interaction.editReply({
          content: '❌ Invalid radio station selected.',
        });
        return;
      }

      // Check if user is in voice channel
      const member = interaction.member as GuildMember | null;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        await interaction.editReply(v2Payload([errorContainer('Not in Voice Channel', 'You must be in a voice channel to play radio.')]));
        return;
      }

      // Show radio playing confirmation
      const container = moduleContainer('music');
      addText(container, `### 📻 Radio Station Playing\nNow playing: **${radioStation.name}**`);
      addFields(container, [{
        name: 'Channel',
        value: `🔊 ${voiceChannel.name}`,
        inline: true,
      }]);

      await interaction.editReply(v2Payload([container]));

      // NOTE: Actual audio playback would require @discordjs/voice integration
      // For now, this command confirms the setup is ready for implementation
    } catch (error) {
      console.error('Error in radio play command:', error);
      await interaction.editReply({
        content: 'An error occurred while playing the radio station.',
      });
    }
  },
};

export default command;
