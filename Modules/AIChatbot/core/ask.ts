import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { config as globalConfig } from '../../../Shared/src/config';
import { checkAICooldown, setAICooldown, getAIConfig, isAIAuthorized } from '../helpers';
import { runAgentFromInteraction } from '../agent';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI a question')
    .addStringOption((option) =>
      option.setName('question').setDescription('Your question for the AI').setRequired(true).setMaxLength(500)
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.ask',
  premiumFeature: 'aichatbot.basic',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
      }

      const question = interaction.options.getString('question', true);
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

      // Check for API key (per-server or global)
      if (!config.apiKey && !globalConfig.ai.defaultApiKey) {
        await interaction.reply({ content: '❌ AI API key is not configured. Please contact a server administrator.', flags: MessageFlags.Ephemeral });
        return;
      }

      const remainingCooldown = await checkAICooldown(interaction.guildId!, interaction.user.id);
      if (remainingCooldown > 0) {
        await interaction.reply({ content: `⏱️ Please wait ${remainingCooldown}s before asking again.`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply();

      try {
        const result = await runAgentFromInteraction(interaction, question);

        const embed = new EmbedBuilder()
          .setTitle('🤖 AI Response')
          .setDescription(result.response.slice(0, 4000))
          .setColor('#7289DA')
          .setFooter({
            text: `Requested by ${interaction.user.username}${result.toolsUsed.length > 0 ? ` • ${result.toolsUsed.length} actions taken` : ''}`,
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        await setAICooldown(interaction.guildId!, interaction.user.id, config.cooldown);
      } catch (error) {
        logger.error(`Error in ask command for ${interaction.guildId!}/${interaction.user.id}`, error);
        await interaction.editReply({ content: '❌ Failed to generate response. Please try again later.' });
      }
    } catch (error) {
      logger.error('Error in ask command execution', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while processing your request.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred.', flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;
