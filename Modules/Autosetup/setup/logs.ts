import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createChannelWithCategory, enableModule, getAutosetupConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-logs')
    .setDescription('Setup logging channels and enable Logging module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.logs',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      // Create channels
      const channels = [];

      const modLogs = await createChannelWithCategory(
        guild,
        config.categoryName,
        'mod-logs',
        ChannelType.GuildText
      );
      if (modLogs.success) channels.push('✅ #mod-logs');

      const messageLogs = await createChannelWithCategory(
        guild,
        config.categoryName,
        'message-logs',
        ChannelType.GuildText
      );
      if (messageLogs.success) channels.push('✅ #message-logs');

      const joinLeaveLogs = await createChannelWithCategory(
        guild,
        config.categoryName,
        'join-leave-logs',
        ChannelType.GuildText
      );
      if (joinLeaveLogs.success) channels.push('✅ #join-leave-logs');

      // Enable logging module
      await enableModule(guild.id, 'logging', {
        modLogChannelId: modLogs.channel?.id,
        messageLogChannelId: messageLogs.channel?.id,
        joinLeaveLogChannelId: joinLeaveLogs.channel?.id,
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Logging Setup Complete\nLogging module has been configured');
      addText(container, `**Created Channels**\n${channels.join('\n') || 'Some channels already exist'}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup logs command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up logging.',
      });
    }
  },
};

export default command;
