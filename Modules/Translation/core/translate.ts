import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  translateText,
  buildTranslationEmbed,
  isValidLanguage,
  findLanguageByName,
  getTranslationConfig,
  incrementTranslationStats,
} from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text to another language')
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('The text to translate')
        .setRequired(true)
        .setMaxLength(2000))
    .addStringOption(opt =>
      opt.setName('to')
        .setDescription('Target language (e.g. "french" or "fr")')
        .setAutocomplete(true))
    .addStringOption(opt =>
      opt.setName('from')
        .setDescription('Source language (auto-detected if not specified)')
        .setAutocomplete(true)) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.translate',
  premiumFeature: 'translation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);
    const guild = interaction.guild!;
    const config = await getTranslationConfig(guild.id);

    const targetInput = interaction.options.getString('to') || config.defaultLanguage;
    const sourceInput = interaction.options.getString('from') || undefined;

    // Validate target language
    const targetLang = isValidLanguage(targetInput) ? targetInput : findLanguageByName(targetInput)[0]?.code;
    if (!targetLang) {
      await interaction.reply({
        content: `Unknown language: \`${targetInput}\`. Use \`/languages\` to see supported languages.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Validate source language if provided
    let sourceLang: string | undefined;
    if (sourceInput) {
      sourceLang = isValidLanguage(sourceInput) ? sourceInput : findLanguageByName(sourceInput)[0]?.code;
      if (!sourceLang) {
        await interaction.reply({
          content: `Unknown source language: \`${sourceInput}\`. Use \`/languages\` to see supported languages.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    await interaction.deferReply();

    const result = await translateText(guild.id, text, targetLang, sourceLang);

    if (!result) {
      await interaction.editReply({ content: '❌ Translation failed. Please try again later.' });
      return;
    }

    const container = buildTranslationEmbed(result, text, interaction.user.displayName);
    await interaction.editReply(v2Payload([container]));

    await incrementTranslationStats(guild.id, result.sourceLang, targetLang);
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const query = focused.value;

    if (!query) {
      // Show popular languages
      const popular = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'ru', 'ar', 'hi', 'it', 'nl', 'pl', 'tr', 'vi', 'th', 'uk', 'sv', 'da'];
      await interaction.respond(
        popular.map(code => ({
          name: `${findLanguageByName(code)[0]?.name || code} (${code})`,
          value: code,
        })),
      );
      return;
    }

    const matches = findLanguageByName(query);
    await interaction.respond(
      matches.map(m => ({ name: `${m.name} (${m.code})`, value: m.code })),
    );
  },
};

export default command;
