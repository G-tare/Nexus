import {  ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { clearHistory, getAIConfig, isAIAuthorized } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aiclear')
    .setDescription('Clear the AI conversation history in this channel'),

  module: 'aichatbot',
  permissionPath: 'aichatbot.aiclear',
  premiumFeature: 'aichatbot.basic',
  cooldown: 2,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
      }

      const config = await getAIConfig(interaction.guildId!);

      // Restricted to bot owners + authorized users
      if (!isAIAuthorized(interaction.user.id, config)) {
        await interaction.reply({ content: '❌ You are not authorized to use the AI system.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (!config.enabled) {
        await interaction.reply({ content: '❌ AI Chatbot is disabled on this server.', flags: MessageFlags.Ephemeral });
        return;
      }

      await clearHistory(interaction.guildId!, interaction.channelId!);

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Conversation Cleared')
        .setDescription('The AI conversation history for this channel has been cleared.')
        .setColor('#43B581')
        .setFooter({ text: `Cleared by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in aiclear command execution', error);
      await interaction.reply({ content: '❌ Failed to clear conversation history.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
