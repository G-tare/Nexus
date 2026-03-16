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
    .setName('autosetup-welcome')
    .setDescription('Setup welcome channel and enable Welcome module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.welcome',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      // Create welcome channel
      const welcomeChannel = await createChannelWithCategory(
        guild,
        config.categoryName,
        'welcome'
      );

      if (!welcomeChannel.success) {
        await interaction.editReply({
          content: 'Failed to create welcome channel.',
        });
        return;
      }

      // Enable welcome module
      await enableModule(guild.id, 'welcome', {
        welcome: {
          enabled: true,
          channelId: welcomeChannel.channel?.id,
          embedMode: true,
          imageMode: 'none',
        },
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Welcome Setup Complete\nWelcome module has been configured');
      addText(container, `**Created Channel**\n✅ #${welcomeChannel.channel?.name}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup welcome command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up welcome.',
      });
    }
  },
};

export default command;
