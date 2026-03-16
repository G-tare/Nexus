import {  ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { config as globalConfig } from '../../../Shared/src/config';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getAIConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aichannel')
    .setDescription('Manage AI chatbot channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option.setName('channel').setDescription('Channel to toggle as AI chat channel').setRequired(true)
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.staff.aichannel',
  premiumFeature: 'aichatbot.management',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      // Bot owner only
      if (!globalConfig.discord.ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ This command is restricted to the bot owner.' });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const config = await getAIConfig(interaction.guildId!);

      const allowedChannels = [...config.allowedChannels];
      const index = allowedChannels.indexOf(channel.id);

      let action: string;
      if (index > -1) {
        allowedChannels.splice(index, 1);
        action = 'removed from';
      } else {
        allowedChannels.push(channel.id);
        action = 'added to';
      }

      await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, allowedChannels });

      const container = moduleContainer('ai_chatbot');
      addText(container, `### 📝 Channel Updated\n${channel} has been ${action} AI chat channels.`);
      addText(container, `**Total AI Channels**\n${allowedChannels.length.toString()}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      logger.error('Error in aichannel command execution', error);
      await interaction.reply({ content: '❌ Failed to update channel configuration.' });
    }
  },
};

export default command;
