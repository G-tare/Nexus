import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAIConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { toolRegistry } from '../tools/registry';
import { config as globalConfig } from '../../../Shared/src/config';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { encrypt, maskKey } from '../../../Shared/src/utils/encryption';
import { moduleContainer, addFields, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aiconfig')
    .setDescription('Configure AI chatbot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── View ──
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current AI chatbot configuration')
    )

    // ── Provider ──
    .addSubcommand((sub) =>
      sub
        .setName('provider')
        .setDescription('Set the AI provider')
        .addStringOption((option) =>
          option.setName('provider').setDescription('AI provider to use').setRequired(true)
            .addChoices(
              { name: 'Groq (free tier, Llama)', value: 'groq' },
              { name: 'Gemini (Google)', value: 'gemini' },
              { name: 'Grok (xAI)', value: 'grok' },
              { name: 'OpenAI', value: 'openai' },
              { name: 'Anthropic', value: 'anthropic' },
            )
        )
    )

    // ── API Key ──
    .addSubcommand((sub) =>
      sub
        .setName('apikey')
        .setDescription('Set the AI provider API key')
        .addStringOption((option) =>
          option.setName('key').setDescription('API key for the provider').setRequired(true).setMaxLength(200)
        )
    )

    // ── Model (preset) ──
    .addSubcommand((sub) =>
      sub
        .setName('model')
        .setDescription('Set the AI model from presets for your current provider')
        .addStringOption((option) =>
          option.setName('preset').setDescription('Choose a model preset').setRequired(true)
            .addChoices(
              // Groq
              { name: '[Groq] Llama 3.3 70B (default)', value: 'groq:llama-3.3-70b-versatile' },
              { name: '[Groq] Llama 3.1 8B (fast)', value: 'groq:llama-3.1-8b-instant' },
              { name: '[Groq] Llama 4 Scout 17B', value: 'groq:meta-llama/llama-4-scout-17b-16e-instruct' },
              { name: '[Groq] Mixtral 8x7B', value: 'groq:mixtral-8x7b-32768' },
              { name: '[Groq] Gemma 2 9B', value: 'groq:gemma2-9b-it' },
              // Gemini
              { name: '[Gemini] 2.0 Flash (default)', value: 'gemini:gemini-2.0-flash' },
              { name: '[Gemini] 2.0 Flash Lite', value: 'gemini:gemini-2.0-flash-lite' },
              { name: '[Gemini] 1.5 Pro', value: 'gemini:gemini-1.5-pro' },
              { name: '[Gemini] 1.5 Flash', value: 'gemini:gemini-1.5-flash' },
              // OpenAI
              { name: '[OpenAI] GPT-4o Mini (default)', value: 'openai:gpt-4o-mini' },
              { name: '[OpenAI] GPT-4o', value: 'openai:gpt-4o' },
              { name: '[OpenAI] GPT-4.1', value: 'openai:gpt-4.1' },
              { name: '[OpenAI] GPT-4.1 Mini', value: 'openai:gpt-4.1-mini' },
              { name: '[OpenAI] GPT-4.1 Nano', value: 'openai:gpt-4.1-nano' },
              // Anthropic
              { name: '[Anthropic] Claude Sonnet 4.5', value: 'anthropic:claude-sonnet-4-5-20250929' },
              { name: '[Anthropic] Claude Haiku 3.5', value: 'anthropic:claude-3-5-haiku-20241022' },
              // Grok
              { name: '[Grok] Grok 3 Mini (default)', value: 'grok:grok-3-mini' },
              { name: '[Grok] Grok 3', value: 'grok:grok-3' },
              { name: '[Grok] Grok 2', value: 'grok:grok-2-1212' },
            )
        )
    )

    // ── Model (custom) ──
    .addSubcommand((sub) =>
      sub
        .setName('model-custom')
        .setDescription('Set a custom AI model name (for models not in presets)')
        .addStringOption((option) =>
          option.setName('model').setDescription('Custom model name string').setRequired(true).setMaxLength(100)
        )
    )

    // ── Temperature ──
    .addSubcommand((sub) =>
      sub
        .setName('temperature')
        .setDescription('Set the response temperature (creativity)')
        .addNumberOption((option) =>
          option.setName('temperature').setDescription('Temperature value (0.0 - 2.0)').setRequired(true).setMinValue(0).setMaxValue(2)
        )
    )

    // ── Max Tokens ──
    .addSubcommand((sub) =>
      sub
        .setName('maxtokens')
        .setDescription('Set the maximum response tokens')
        .addIntegerOption((option) =>
          option.setName('tokens').setDescription('Maximum tokens (50 - 8000)').setRequired(true).setMinValue(50).setMaxValue(8000)
        )
    )

    // ── Cooldown ──
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set the per-user cooldown')
        .addIntegerOption((option) =>
          option.setName('seconds').setDescription('Cooldown in seconds (0 - 60)').setRequired(true).setMinValue(0).setMaxValue(60)
        )
    )

    // ── Toggle ──
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Toggle AI chatbot features')
        .addStringOption((option) =>
          option.setName('feature').setDescription('Feature to toggle').setRequired(true)
            .addChoices(
              { name: 'Auto-reply in AI channels', value: 'autoReply' },
              { name: 'Reply on @mention', value: 'mentionReply' },
              { name: 'Enable/Disable module', value: 'enabled' },
              { name: 'Agent mode (tool-use)', value: 'agentEnabled' },
              { name: 'Confirm destructive actions', value: 'confirmDestructive' },
            )
        )
    )

    // ── Trigger Phrase ──
    .addSubcommand((sub) =>
      sub
        .setName('trigger')
        .setDescription('Set the activation trigger phrase (e.g., "hey nexus")')
        .addStringOption((option) =>
          option.setName('phrase').setDescription('Trigger phrase').setRequired(true).setMaxLength(50)
        )
    )

    // ── Max Tool Calls ──
    .addSubcommand((sub) =>
      sub
        .setName('maxtoolcalls')
        .setDescription('Set max tool calls per message')
        .addIntegerOption((option) =>
          option.setName('max').setDescription('Max tool calls (1 - 30)').setRequired(true).setMinValue(1).setMaxValue(30)
        )
    )

    // ── Disable/Enable Tool ──
    .addSubcommand((sub) =>
      sub
        .setName('tool')
        .setDescription('Enable or disable a specific AI tool')
        .addStringOption((option) =>
          option.setName('tool_id').setDescription('Tool ID (e.g., channels.delete, roles.create)').setRequired(true).setMaxLength(50)
        )
    )

    // ── List Tools ──
    .addSubcommand((sub) =>
      sub.setName('tools').setDescription('List all available AI tools and their status')
    )

    // ── Authorize User ──
    .addSubcommand((sub) =>
      sub
        .setName('authorize')
        .setDescription('Add or remove an authorized AI user')
        .addUserOption((option) =>
          option.setName('user').setDescription('User to authorize/deauthorize').setRequired(true)
        )
    )

    // ── Conversation Timeout ──
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Set conversation session timeout (minutes of inactivity before trigger phrase is required again)')
        .addIntegerOption((option) =>
          option.setName('minutes').setDescription('Timeout in minutes (1 - 30)').setRequired(true).setMinValue(1).setMaxValue(30)
        )
    )

    // ── List Authorized Users ──
    .addSubcommand((sub) =>
      sub.setName('authorized').setDescription('List all authorized AI users')
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.staff.aiconfig',
  premiumFeature: 'aichatbot.management',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      // Bot owner only — not just server owner
      if (!globalConfig.discord.ownerIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ This command is restricted to the bot owner.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getAIConfig(interaction.guildId!);

      switch (subcommand) {
        case 'view': {
          const container = moduleContainer('ai_chatbot');
          addText(container, '### 🤖 AI Chatbot Configuration');
          addFields(container, [
            { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Provider', value: config.provider, inline: true },
            { name: 'Model', value: config.model || '(provider default)', inline: true },
            { name: 'Temperature', value: config.temperature.toString(), inline: true },
            { name: 'Max Tokens', value: config.maxTokens.toString(), inline: true },
            { name: 'Cooldown', value: `${config.cooldown}s`, inline: true },
            { name: 'Auto-reply', value: config.autoReply ? '✅' : '❌', inline: true },
            { name: 'Mention Reply', value: config.mentionReply ? '✅' : '❌', inline: true },
            { name: 'Max History', value: config.maxHistory.toString(), inline: true },
            { name: 'API Key', value: config.apiKey ? `✅ \`${maskKey(config.apiKey)}\`` : '❌ Not set (using global)', inline: true },
            { name: 'Agent Mode', value: config.agentEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Trigger Phrase', value: `"${config.triggerPhrase}"`, inline: true },
            { name: 'Confirm Destructive', value: config.confirmDestructive ? '✅' : '❌', inline: true },
            { name: 'Max Tool Calls', value: config.maxToolCalls.toString(), inline: true },
            { name: 'Disabled Tools', value: config.disabledTools.length > 0 ? config.disabledTools.join(', ') : 'None', inline: true },
            { name: 'Session Timeout', value: `${config.conversationTimeout ?? 5} min`, inline: true },
            { name: 'Authorized Users', value: config.authorizedUsers.length > 0 ? config.authorizedUsers.map((id) => `<@${id}>`).join(', ') : 'Bot owners only', inline: true },
            { name: 'AI Channels', value: config.allowedChannels.length > 0 ? config.allowedChannels.map((id) => `<#${id}>`).join(', ') : 'None', inline: false }
          ]);
          addText(container, `-# Viewed by ${interaction.user.username}`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'provider': {
          const provider = interaction.options.getString('provider', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, provider });
          await interaction.reply({ content: `✅ AI provider set to **${provider}**.` });
          break;
        }

        case 'apikey': {
          const key = interaction.options.getString('key', true);
          // Encrypt the key before storing
          const encryptedKey = encrypt(key);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, apiKey: encryptedKey });
          await interaction.reply({ content: `✅ API key has been securely encrypted and saved. Key: \`${maskKey(key)}\`` });
          break;
        }

        case 'model': {
          const preset = interaction.options.getString('preset', true);
          // Format: "provider:model" — extract both parts
          const colonIdx = preset.indexOf(':');
          const presetProvider = preset.substring(0, colonIdx);
          const presetModel = preset.substring(colonIdx + 1);

          // Also switch the provider to match the preset
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', {
            ...config,
            model: presetModel,
            provider: presetProvider,
          });
          await interaction.reply({
            content: `✅ AI model set to **${presetModel}** (provider: **${presetProvider}**).`,
          });
          break;
        }

        case 'model-custom': {
          const model = interaction.options.getString('model', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, model });
          await interaction.reply({ content: `✅ AI model set to **${model}** (custom). Make sure this model is available on your selected provider (**${config.provider}**).` });
          break;
        }

        case 'temperature': {
          const temperature = interaction.options.getNumber('temperature', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, temperature });
          await interaction.reply({ content: `✅ Temperature set to **${temperature}**.` });
          break;
        }

        case 'maxtokens': {
          const maxTokens = interaction.options.getInteger('tokens', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, maxTokens });
          await interaction.reply({ content: `✅ Max tokens set to **${maxTokens}**.` });
          break;
        }

        case 'cooldown': {
          const cooldown = interaction.options.getInteger('seconds', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, cooldown });
          await interaction.reply({ content: `✅ Cooldown set to **${cooldown}s**.` });
          break;
        }

        case 'toggle': {
          const feature = interaction.options.getString('feature', true) as
            'autoReply' | 'mentionReply' | 'enabled' | 'agentEnabled' | 'confirmDestructive';
          const newValue = !config[feature];
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, [feature]: newValue });

          const labels: Record<string, string> = {
            autoReply: 'Auto-reply',
            mentionReply: 'Mention reply',
            enabled: 'AI Chatbot',
            agentEnabled: 'Agent mode (tool-use)',
            confirmDestructive: 'Destructive action confirmation',
          };
          await interaction.reply({ content: `✅ ${labels[feature]} is now ${newValue ? '**enabled**' : '**disabled**'}.` });
          break;
        }

        case 'trigger': {
          const phrase = interaction.options.getString('phrase', true).toLowerCase().trim();
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, triggerPhrase: phrase });
          await interaction.reply({ content: `✅ Trigger phrase set to **"${phrase}"**. Users can now say "${phrase} <message>" to activate the AI.` });
          break;
        }

        case 'maxtoolcalls': {
          const max = interaction.options.getInteger('max', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, maxToolCalls: max });
          await interaction.reply({ content: `✅ Max tool calls per message set to **${max}**.` });
          break;
        }

        case 'tool': {
          const toolId = interaction.options.getString('tool_id', true).toLowerCase();
          const tool = toolRegistry.get(toolId);
          if (!tool) {
            await interaction.reply({ content: `❌ Unknown tool: \`${toolId}\`. Use \`/aiconfig tools\` to see available tools.` });
            return;
          }

          const disabledTools = [...config.disabledTools];
          const idx = disabledTools.indexOf(toolId);
          if (idx > -1) {
            disabledTools.splice(idx, 1);
            await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, disabledTools });
            await interaction.reply({ content: `✅ Tool **${tool.name}** (\`${toolId}\`) has been **enabled**.` });
          } else {
            disabledTools.push(toolId);
            await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, disabledTools });
            await interaction.reply({ content: `✅ Tool **${tool.name}** (\`${toolId}\`) has been **disabled**.` });
          }
          break;
        }

        case 'tools': {
          const allTools = toolRegistry.getAll();
          const disabledSet = new Set(config.disabledTools);

          const categories = new Map<string, string[]>();
          for (const t of allTools) {
            const lines = categories.get(t.category) ?? [];
            const icon = disabledSet.has(t.id) ? '❌' : '✅';
            const destructive = t.isDestructive ? ' ⚠️' : '';
            lines.push(`${icon} \`${t.id}\` — ${t.name}${destructive}`);
            categories.set(t.category, lines);
          }

          const container = moduleContainer('ai_chatbot');
          addText(container, `### 🛠️ AI Tools (${allTools.length})\n✅ = enabled, ❌ = disabled, ⚠️ = destructive\nUse \`/aiconfig tool <id>\` to toggle.`);

          for (const [cat, lines] of categories) {
            addText(container, `**${cat.charAt(0).toUpperCase() + cat.slice(1)}**\n${lines.join('\n')}`);
          }

          addText(container, `-# ${config.disabledTools.length} tools disabled`);
          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'authorize': {
          const user = interaction.options.getUser('user', true);
          const authorizedUsers = [...config.authorizedUsers];
          const idx = authorizedUsers.indexOf(user.id);

          if (idx > -1) {
            authorizedUsers.splice(idx, 1);
            await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, authorizedUsers });
            await interaction.reply({ content: `✅ <@${user.id}> has been **removed** from authorized AI users.` });
          } else {
            authorizedUsers.push(user.id);
            await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, authorizedUsers });
            await interaction.reply({ content: `✅ <@${user.id}> has been **added** as an authorized AI user.` });
          }
          break;
        }

        case 'timeout': {
          const minutes = interaction.options.getInteger('minutes', true);
          await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, conversationTimeout: minutes });
          await interaction.reply({ content: `✅ Conversation session timeout set to **${minutes} minute${minutes === 1 ? '' : 's'}**. After ${minutes} min of inactivity, users will need to use the trigger phrase again.` });
          break;
        }

        case 'authorized': {
          const users = config.authorizedUsers;
          const ownerIds = globalConfig.discord.ownerIds;

          const container = moduleContainer('ai_chatbot');
          addText(container, '### 🔐 Authorized AI Users');
          addText(container, `**Bot Owners (always authorized)**\n${ownerIds.length > 0 ? ownerIds.map(id => `<@${id}>`).join(', ') : 'None configured'}`);
          addText(container, `**Authorized Users**\n${users.length > 0 ? users.map(id => `<@${id}>`).join(', ') : 'None — use \`/aiconfig authorize\` to add users'}`);
          addText(container, `-# Total: ${ownerIds.length + users.length} authorized`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        default:
          await interaction.reply({ content: '❌ Unknown subcommand.' });
      }
    } catch (error) {
      logger.error('Error in aiconfig command execution', error);
      await interaction.reply({ content: '❌ Failed to update configuration.' });
    }
  },
};

export default command;
