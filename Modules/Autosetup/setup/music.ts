import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createChannelWithCategory, createVoiceChannel, enableModule, getAutosetupConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-music')
    .setDescription('Setup music channels and enable Music module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.music',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      const channels = [];

      // Create text channel
      const musicRequests = await createChannelWithCategory(
        guild,
        config.categoryName,
        'music-requests'
      );
      if (musicRequests.success) channels.push('✅ #music-requests');

      // Create voice channel
      const musicVoice = await createVoiceChannel(guild, '🎵 Music');
      if (musicVoice.success) channels.push('✅ 🎵 Music (voice)');

      // Enable music module
      await enableModule(guild.id, 'music', {
        restrictedTextChannels: musicRequests.channel ? [musicRequests.channel.id] : [],
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Music Setup Complete\nMusic module has been configured');
      addText(container, `**Created Channels**\n${channels.join('\n') || 'Some channels already exist'}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup music command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up music channels.',
      });
    }
  },
};

export default command;
