import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import {
  getTranslationConfig,
  getTranslationCount,
  getAllChannelTranslations,
  getLanguageName,
  isValidLanguage,
  findLanguageByName,
} from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('translateconfig')
    .setDescription('View or update translation settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current translation settings'))
    .addSubcommand(sub =>
      sub.setName('provider')
        .setDescription('Set the translation provider')
        .addStringOption(opt =>
          opt.setName('provider')
            .setDescription('Translation provider')
            .setRequired(true)
            .addChoices(
              { name: 'Google Translate (free)', value: 'google' },
              { name: 'LibreTranslate (self-hosted)', value: 'libre' },
            )))
    .addSubcommand(sub =>
      sub.setName('libreurl')
        .setDescription('Set the LibreTranslate instance URL')
        .addStringOption(opt =>
          opt.setName('url')
            .setDescription('LibreTranslate URL (e.g. http://localhost:5000)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('flagreactions')
        .setDescription('Toggle flag emoji reaction translations')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable flag reactions')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('defaultlang')
        .setDescription('Set the default target language for the server')
        .addStringOption(opt =>
          opt.setName('language')
            .setDescription('Default language code (e.g. en, fr, es)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('webhooks')
        .setDescription('Toggle webhook-based translations (preserves author name/avatar)')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Use webhooks for auto-translate')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('cooldown')
        .setDescription('Set per-user translation cooldown')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Cooldown in seconds (0-60)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(60)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.translateconfig',
  premiumFeature: 'translation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const config = await getTranslationConfig(guild.id);
      const channels = await getAllChannelTranslations(guild.id);
      const totalTranslations = await getTranslationCount(guild.id);

      const channelLines = channels.length > 0
        ? channels.map(c => `<#${c.channelId}> → ${getLanguageName(c.targetLang)}`).join('\n')
        : 'None configured';

      const container = new ContainerBuilder().setAccentColor(0x4285F4);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🌐 Translation Settings'));
      addText(container, `**Provider**\n${config.provider === 'google' ? 'Google Translate' : `LibreTranslate (${config.libreUrl})`}`);
      addText(container, `**Default Language**\n${getLanguageName(config.defaultLanguage)} (\`${config.defaultLanguage}\`)`);
      addText(container, `**Flag Reactions**\n${config.flagReactions ? '✅ Enabled' : '❌ Disabled'}`);
      addText(container, `**Webhooks**\n${config.useWebhooks ? '✅ Enabled' : '❌ Disabled'}`);
      addText(container, `**User Cooldown**\n${config.userCooldown}s`);
      addText(container, `**Total Translations**\n${totalTranslations.toLocaleString()}`);
      addText(container, `**Auto-Translate Channels (${channels.length})**\n${channelLines}`);

      await interaction.reply(v2Payload([container]));
      return;
    }

    if (sub === 'provider') {
      const provider = interaction.options.getString('provider', true);
      await moduleConfig.updateConfig(guild.id, 'translation', { provider });
      await interaction.reply({ content: `✅ Translation provider set to **${provider === 'google' ? 'Google Translate' : 'LibreTranslate'}**.` });
      return;
    }

    if (sub === 'libreurl') {
      const url = interaction.options.getString('url', true);
      await moduleConfig.updateConfig(guild.id, 'translation', { libreUrl: url });
      await interaction.reply({ content: `✅ LibreTranslate URL set to \`${url}\`.` });
      return;
    }

    if (sub === 'flagreactions') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'translation', { flagReactions: enabled });
      await interaction.reply({ content: `✅ Flag reaction translations ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'defaultlang') {
      const langInput = interaction.options.getString('language', true);
      const lang = isValidLanguage(langInput) ? langInput : findLanguageByName(langInput)[0]?.code;
      if (!lang) {
        await interaction.reply({ content: `Unknown language: \`${langInput}\`.` });
        return;
      }
      await moduleConfig.updateConfig(guild.id, 'translation', { defaultLanguage: lang });
      await interaction.reply({ content: `✅ Default language set to **${getLanguageName(lang)}** (\`${lang}\`).` });
      return;
    }

    if (sub === 'webhooks') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await moduleConfig.updateConfig(guild.id, 'translation', { useWebhooks: enabled });
      await interaction.reply({ content: `✅ Webhook translations ${enabled ? 'enabled' : 'disabled'}.` });
      return;
    }

    if (sub === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'translation', { userCooldown: seconds });
      await interaction.reply({ content: `✅ Translation cooldown set to **${seconds}s** per user.` });
      return;
    }
  },
};

export default command;
