import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  setChannelTranslation,
  isValidLanguage,
  findLanguageByName,
  getLanguageName,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('translatechannel')
    .setDescription('Set a channel to auto-translate all messages to a language')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to auto-translate')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('language')
        .setDescription('Target language for translations')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.translatechannel',
  premiumFeature: 'translation.auto',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channel = interaction.options.getChannel('channel', true);
    const langInput = interaction.options.getString('language', true);

    const targetLang = isValidLanguage(langInput) ? langInput : findLanguageByName(langInput)[0]?.code;
    if (!targetLang) {
      await interaction.reply({
        content: `Unknown language: \`${langInput}\`. Use \`/languages\` to see supported languages.`,
        ephemeral: true,
      });
      return;
    }

    await setChannelTranslation(guild.id, channel.id, targetLang, interaction.user.id);

    await interaction.reply({
      content: `✅ <#${channel.id}> will now auto-translate messages to **${getLanguageName(targetLang)}** (\`${targetLang}\`).`,
    });
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
