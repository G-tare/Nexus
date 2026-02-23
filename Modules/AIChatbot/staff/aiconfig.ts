import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAIConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aiconfig')
    .setDescription('Configure AI chatbot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current AI chatbot configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('provider')
        .setDescription('Set the AI provider')
        .addStringOption((option) =>
          option.setName('provider').setDescription('AI provider to use').setRequired(true)
            .addChoices({ name: 'OpenAI', value: 'openai' }, { name: 'Anthropic', value: 'anthropic' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('model')
        .setDescription('Set the AI model')
        .addStringOption((option) =>
          option.setName('model').setDescription('Model name (e.g., gpt-4, claude-3-sonnet)').setRequired(true).setMaxLength(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('temperature')
        .setDescription('Set the response temperature (creativity)')
        .addNumberOption((option) =>
          option.setName('temperature').setDescription('Temperature value (0.0 - 2.0)').setRequired(true).setMinValue(0).setMaxValue(2)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('maxtokens')
        .setDescription('Set the maximum response tokens')
        .addIntegerOption((option) =>
          option.setName('tokens').setDescription('Maximum tokens (50 - 4000)').setRequired(true).setMinValue(50).setMaxValue(4000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set the per-user cooldown')
        .addIntegerOption((option) =>
          option.setName('seconds').setDescription('Cooldown in seconds (0 - 60)').setRequired(true).setMinValue(0).setMaxValue(60)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Toggle AI chatbot features')
        .addStringOption((option) =>
          option.setName('feature').setDescription('Feature to toggle').setRequired(true)
            .addChoices(
              { name: 'Auto-reply in AI channels', value: 'autoReply' },
              { name: 'Reply on @mention', value: 'mentionReply' },
              { name: 'Enable/Disable module', value: 'enabled' }
            )
        )
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.staff.aiconfig',
  premiumFeature: 'aichatbot.management',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getAIConfig(interaction.guildId!);

      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setColor('#7289DA')
          .setTitle('🤖 AI Chatbot Configuration')
          .addFields(
            { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Provider', value: config.provider, inline: true },
            { name: 'Model', value: config.model, inline: true },
            { name: 'Temperature', value: config.temperature.toString(), inline: true },
            { name: 'Max Tokens', value: config.maxTokens.toString(), inline: true },
            { name: 'Cooldown', value: `${config.cooldown}s`, inline: true },
            { name: 'Auto-reply', value: config.autoReply ? '✅' : '❌', inline: true },
            { name: 'Mention Reply', value: config.mentionReply ? '✅' : '❌', inline: true },
            { name: 'Max History', value: config.maxHistory.toString(), inline: true },
            { name: 'API Key', value: config.apiKey ? '✅ Set' : '❌ Not set', inline: true },
            { name: 'AI Channels', value: config.allowedChannels.length > 0 ? config.allowedChannels.map((id) => `<#${id}>`).join(', ') : 'None', inline: false }
          )
          .setFooter({ text: `Viewed by ${interaction.user.username}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else if (subcommand === 'provider') {
        const provider = interaction.options.getString('provider', true) as 'openai' | 'anthropic';
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, provider });
        await interaction.reply({ content: `✅ AI provider set to **${provider}**.`, ephemeral: true });
      } else if (subcommand === 'model') {
        const model = interaction.options.getString('model', true);
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, model });
        await interaction.reply({ content: `✅ AI model set to **${model}**.`, ephemeral: true });
      } else if (subcommand === 'temperature') {
        const temperature = interaction.options.getNumber('temperature', true);
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, temperature });
        await interaction.reply({ content: `✅ Temperature set to **${temperature}**.`, ephemeral: true });
      } else if (subcommand === 'maxtokens') {
        const maxTokens = interaction.options.getInteger('tokens', true);
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, maxTokens });
        await interaction.reply({ content: `✅ Max tokens set to **${maxTokens}**.`, ephemeral: true });
      } else if (subcommand === 'cooldown') {
        const cooldown = interaction.options.getInteger('seconds', true);
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, cooldown });
        await interaction.reply({ content: `✅ Cooldown set to **${cooldown}s**.`, ephemeral: true });
      } else if (subcommand === 'toggle') {
        const feature = interaction.options.getString('feature', true) as 'autoReply' | 'mentionReply' | 'enabled';
        const newValue = !config[feature];
        await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, [feature]: newValue });

        const label = feature === 'autoReply' ? 'Auto-reply' : feature === 'mentionReply' ? 'Mention reply' : 'AI Chatbot';
        await interaction.reply({ content: `✅ ${label} is now ${newValue ? '**enabled**' : '**disabled**'}.`, ephemeral: true });
      }
    } catch (error) {
      logger.error('Error in aiconfig command execution', error);
      await interaction.reply({ content: '❌ Failed to update configuration.', ephemeral: true });
    }
  },
};

export default command;
