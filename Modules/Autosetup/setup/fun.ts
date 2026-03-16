import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createChannelWithCategory, enableModule, getAutosetupConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-fun')
    .setDescription('Setup fun channels and enable Fun module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.fun',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      const channels = [];

      const gamesChannel = await createChannelWithCategory(
        guild,
        config.categoryName,
        'games'
      );
      if (gamesChannel.success) channels.push('✅ #games');

      const memesChannel = await createChannelWithCategory(
        guild,
        config.categoryName,
        'memes'
      );
      if (memesChannel.success) channels.push('✅ #memes');

      // Enable fun module
      await enableModule(guild.id, 'fun');

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Fun Setup Complete\nFun module has been configured');
      addText(container, `**Created Channels**\n${channels.join('\n') || 'Some channels already exist'}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup fun command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up fun channels.',
      });
    }
  },
};

export default command;
