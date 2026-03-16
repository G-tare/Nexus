import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  TextChannel, MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  translateText,
  isValidLanguage,
  findLanguageByName,
  getTranslationConfig,
  getLanguageName,
  incrementTranslationStats,
} from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('translatelast')
    .setDescription('Translate the last N messages in this channel')
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of messages to translate (1-10)')
        .setMinValue(1)
        .setMaxValue(10))
    .addStringOption(opt =>
      opt.setName('to')
        .setDescription('Target language')
        .setAutocomplete(true)) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.translatelast',
  premiumFeature: 'translation.basic',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const count = interaction.options.getInteger('count') || 1;
    const config = await getTranslationConfig(guild.id);
    const targetInput = interaction.options.getString('to') || config.defaultLanguage;

    const targetLang = isValidLanguage(targetInput) ? targetInput : findLanguageByName(targetInput)[0]?.code;
    if (!targetLang) {
      await interaction.reply({
        content: `Unknown language: \`${targetInput}\`. Use \`/languages\` to see supported languages.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const channel = interaction.channel;
    if (!channel || !('messages' in channel)) {
      await interaction.editReply({ content: '❌ Cannot fetch messages in this channel.' });
      return;
    }

    // Fetch last N messages (excluding the interaction)
    const messages = await (channel as TextChannel).messages.fetch({ limit: count + 1 });
    const filtered = [...messages.values()]
      .filter(m => !m.interaction && m.content && m.content.length >= 2)
      .slice(0, count);

    if (filtered.length === 0) {
      await interaction.editReply({ content: '❌ No translatable messages found.' });
      return;
    }

    const translations: Array<{ author: string; original: string; translated: string; sourceLang: string }> = [];

    for (const msg of filtered) {
      const result = await translateText(guild.id, msg.content, targetLang);
      if (result && result.translatedText.toLowerCase().trim() !== msg.content.toLowerCase().trim()) {
        translations.push({
          author: msg.author.displayName,
          original: msg.content.slice(0, 200),
          translated: result.translatedText.slice(0, 200),
          sourceLang: result.sourceLang,
        });
        await incrementTranslationStats(guild.id, result.sourceLang, targetLang);
      }
    }

    if (translations.length === 0) {
      await interaction.editReply({ content: '❌ All messages appear to already be in the target language.' });
      return;
    }

    const container = new ContainerBuilder().setAccentColor(0x4285F4);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🌐 Translated ${translations.length} message${translations.length > 1 ? 's' : ''} → ${getLanguageName(targetLang)}`));

    for (const t of translations) {
      const fieldText = `**${t.author} (${getLanguageName(t.sourceLang)})**\n${t.original}\n**→** ${t.translated}`;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldText));
    }

    await interaction.editReply(v2Payload([container]));
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const query = interaction.options.getFocused();
    if (!query) {
      const popular = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'ru', 'ar'];
      await interaction.respond(
        popular.map(code => ({ name: `${getLanguageName(code)} (${code})`, value: code })),
      );
      return;
    }
    const matches = findLanguageByName(query);
    await interaction.respond(matches.map(m => ({ name: `${m.name} (${m.code})`, value: m.code })));
  },
};

export default command;
