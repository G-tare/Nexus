import {  ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { config as globalConfig } from '../../../Shared/src/config';
import { getAIConfig, getPersona, setPersona } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aipersona')
    .setDescription('Manage the AI chatbot persona/system prompt')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View the current AI persona')
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set a custom AI persona')
        .addStringOption((option) =>
          option.setName('persona').setDescription('The system prompt / persona for the AI').setRequired(true).setMaxLength(2000)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Reset the AI persona to the default')
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.staff.aipersona',
  premiumFeature: 'aichatbot.management',
  cooldown: 5,

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

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'view') {
        const persona = await getPersona(interaction.guildId!);

        const container = moduleContainer('ai_chatbot');
        addText(container, '### 🤖 Current AI Persona');
        addText(container, `\`\`\`\n${persona.slice(0, 1900)}\n\`\`\``);
        addFooter(container, `Character count: ${persona.length}`);

        await interaction.reply(v2Payload([container]));
      } else if (subcommand === 'set') {
        const persona = interaction.options.getString('persona', true);

        await setPersona(interaction.guildId!, persona);

        const container = moduleContainer('ai_chatbot');
        addText(container, '### ✅ Persona Updated\nThe AI persona has been updated.');
        addText(container, `**Preview:**\n\`\`\`\n${persona.slice(0, 500)}\n\`\`\``);
        addFooter(container, `Updated by ${interaction.user.username}`);

        await interaction.reply(v2Payload([container]));
      } else if (subcommand === 'reset') {
        const config = await getAIConfig(interaction.guildId!);
        await setPersona(interaction.guildId!, config.systemPrompt);

        const container = moduleContainer('ai_chatbot');
        addText(container, '### ✅ Persona Reset\nThe AI persona has been reset to the default system prompt.');
        addFooter(container, `Reset by ${interaction.user.username}`);

        await interaction.reply(v2Payload([container]));
      }
    } catch (error) {
      logger.error('Error in aipersona command execution', error);
      await interaction.reply({ content: '❌ Failed to update persona.' });
    }
  },
};

export default command;
