import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, addFooter, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function createFilterContainer(title: string, words: string[], wildcards: string[], regexes: string[], page: number = 1) {
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil((words.length + wildcards.length + regexes.length) / itemsPerPage));
  const validPage = Math.max(1, Math.min(page, totalPages));

  let description = '';
  let count = 0;
  let currentPage = 1;
  const startIdx = (validPage - 1) * itemsPerPage;
  let itemsShown = 0;

  // Words
  for (let i = 0; i < words.length; i++) {
    if (currentPage === validPage && itemsShown < itemsPerPage) {
      description += `**Word ${i + 1}:** \`${words[i]}\`\n`;
      itemsShown++;
    }
    count++;
    if (itemsShown >= itemsPerPage && currentPage === validPage) break;
  }

  // Wildcards
  for (let i = 0; i < wildcards.length; i++) {
    if (currentPage === validPage && itemsShown < itemsPerPage) {
      description += `**Wildcard ${i + 1}:** \`${wildcards[i]}\`\n`;
      itemsShown++;
    }
    count++;
    if (itemsShown >= itemsPerPage && currentPage === validPage) break;
  }

  // Regexes
  for (let i = 0; i < regexes.length; i++) {
    if (currentPage === validPage && itemsShown < itemsPerPage) {
      description += `**Regex ${i + 1}:** \`${regexes[i]}\`\n`;
      itemsShown++;
    }
    count++;
    if (itemsShown >= itemsPerPage && currentPage === validPage) break;
  }

  if (count === 0) {
    description = '(no filters configured)';
  }

  const container = moduleContainer('automod');
  addText(container, `### ${title}`);
  addText(container, description);
  addFooter(container, `Page ${validPage}/${totalPages} • Total filters: ${count}`);
  return container;
}

export default {
  module: 'automod',
  permissionPath: 'automod.staff.wordfilter',
  premiumFeature: 'automod.basic',
  permissions: [PermissionFlagsBits.ManageGuild],

  data: new SlashCommandBuilder()
    .setName('wordfilter')
    .setDescription('Manage the word filter')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a word to the filter')
        .addStringOption(opt =>
          opt
            .setName('word')
            .setDescription('Word to filter')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a word from the filter')
        .addStringOption(opt =>
          opt
            .setName('word')
            .setDescription('Word to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('add-wildcard')
        .setDescription('Add a wildcard pattern (e.g., bad*word)')
        .addStringOption(opt =>
          opt
            .setName('pattern')
            .setDescription('Wildcard pattern to add')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove-wildcard')
        .setDescription('Remove a wildcard pattern')
        .addStringOption(opt =>
          opt
            .setName('pattern')
            .setDescription('Wildcard pattern to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('add-regex')
        .setDescription('Add a regex pattern')
        .addStringOption(opt =>
          opt
            .setName('pattern')
            .setDescription('Regex pattern to add')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove-regex')
        .setDescription('Remove a regex pattern')
        .addStringOption(opt =>
          opt
            .setName('pattern')
            .setDescription('Regex pattern to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Show all filtered words, wildcards, and regex patterns')
        .addIntegerOption(opt =>
          opt
            .setName('page')
            .setDescription('Page number')
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('import')
        .setDescription('Bulk import words from a comma-separated list')
        .addStringOption(opt =>
          opt
            .setName('words')
            .setDescription('Comma-separated list of words to import')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let updatedConfig: AutomodConfig = { ...config };
      let message = '';

      if (subcommand === 'add') {
        const word = interaction.options.getString('word', true).toLowerCase();

        if (word.length === 0 || word.length > 100) {
          await interaction.editReply(errorReply('Word Filter Error', 'Word must be between 1 and 100 characters'));
          return;
        }

        const words = [...new Set([...(config.wordfilter.words || []), word])];

        if (words.length === (config.wordfilter.words || []).length) {
          await interaction.editReply(errorReply('Word Already Exists', `Word **${word}** is already in the filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, words };
        message = `Word **${word}** added to filter`;
      } else if (subcommand === 'remove') {
        const word = interaction.options.getString('word', true).toLowerCase();
        const words = (config.wordfilter.words || []).filter(w => w !== word);

        if (words.length === (config.wordfilter.words || []).length) {
          await interaction.editReply(errorReply('Word Not Found', `Word **${word}** not found in filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, words };
        message = `Word **${word}** removed from filter`;
      } else if (subcommand === 'add-wildcard') {
        const pattern = interaction.options.getString('pattern', true).toLowerCase();

        if (pattern.length === 0 || pattern.length > 100) {
          await interaction.editReply(errorReply('Pattern Error', 'Pattern must be between 1 and 100 characters'));
          return;
        }

        const wildcards = [...new Set([...(config.wordfilter.wildcards || []), pattern])];

        if (wildcards.length === (config.wordfilter.wildcards || []).length) {
          await interaction.editReply(errorReply('Pattern Already Exists', `Pattern **${pattern}** is already in the filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, wildcards };
        message = `Wildcard pattern **${pattern}** added to filter`;
      } else if (subcommand === 'remove-wildcard') {
        const pattern = interaction.options.getString('pattern', true).toLowerCase();
        const wildcards = (config.wordfilter.wildcards || []).filter(w => w !== pattern);

        if (wildcards.length === (config.wordfilter.wildcards || []).length) {
          await interaction.editReply(errorReply('Pattern Not Found', `Pattern **${pattern}** not found in filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, wildcards };
        message = `Wildcard pattern **${pattern}** removed from filter`;
      } else if (subcommand === 'add-regex') {
        const pattern = interaction.options.getString('pattern', true);

        if (!isValidRegex(pattern)) {
          await interaction.editReply(errorReply('Invalid Regex', 'Invalid regex pattern. Please check your syntax'));
          return;
        }

        if (pattern.length === 0 || pattern.length > 200) {
          await interaction.editReply(errorReply('Pattern Error', 'Pattern must be between 1 and 200 characters'));
          return;
        }

        const regexPatterns = [...new Set([...(config.wordfilter.regexPatterns || []), pattern])];

        if (regexPatterns.length === (config.wordfilter.regexPatterns || []).length) {
          await interaction.editReply(errorReply('Pattern Already Exists', `Pattern **${pattern}** is already in the filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, regexPatterns };
        message = `Regex pattern **${pattern}** added to filter`;
      } else if (subcommand === 'remove-regex') {
        const pattern = interaction.options.getString('pattern', true);
        const regexPatterns = (config.wordfilter.regexPatterns || []).filter((w: any) => w !== pattern);

        if (regexPatterns.length === (config.wordfilter.regexPatterns || []).length) {
          await interaction.editReply(errorReply('Pattern Not Found', `Pattern **${pattern}** not found in filter`));
          return;
        }

        updatedConfig.wordfilter = { ...config.wordfilter, regexPatterns };
        message = `Regex pattern **${pattern}** removed from filter`;
      } else if (subcommand === 'list') {
        const page = interaction.options.getInteger('page') || 1;
        const container = createFilterContainer(
          'Word Filter Configuration',
          config.wordfilter.words || [],
          config.wordfilter.wildcards || [],
          config.wordfilter.regexPatterns || [],
          page
        );
        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        return;
      } else if (subcommand === 'import') {
        const input = interaction.options.getString('words', true);
        const newWords = input
          .split(',')
          .map(w => w.trim().toLowerCase())
          .filter(w => w.length > 0 && w.length <= 100);

        if (newWords.length === 0) {
          await interaction.editReply(errorReply('Import Error', 'No valid words provided'));
          return;
        }

        const currentWords = config.wordfilter.words || [];
        const words = [...new Set([...currentWords, ...newWords])];
        const added = words.length - currentWords.length;

        updatedConfig.wordfilter = { ...config.wordfilter, words };
        message = `Imported **${added}** words to filter\n**Total words:** ${words.length}`;
      }

      if (subcommand !== 'list') {
        await moduleConfig.setConfig(guildId, 'automod', updatedConfig);

        await interaction.editReply(successReply('Word Filter Updated', message));
      }
    } catch (error) {
      await interaction.editReply(errorReply('Configuration Error', 'Failed to update word filter settings'));
      console.error('[Automod] Wordfilter command error:', error);
    }
  }
} as BotCommand;
