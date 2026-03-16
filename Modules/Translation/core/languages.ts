import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { SUPPORTED_LANGUAGES } from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('languages')
    .setDescription('List all supported languages for translation')
    .addStringOption(opt =>
      opt.setName('search')
        .setDescription('Search for a specific language')) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.languages',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const search = interaction.options.getString('search')?.toLowerCase();
    const entries = Object.entries(SUPPORTED_LANGUAGES);

    let filtered = entries;
    if (search) {
      filtered = entries.filter(
        ([code, name]) => name.toLowerCase().includes(search) || code.toLowerCase().includes(search),
      );
    }

    if (filtered.length === 0) {
      await interaction.reply({ content: `No languages matching \`${search}\`.`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Split into pages of ~40 per embed field (Discord limit is 1024 chars per field)
    const perPage = 40;
    const page = filtered.slice(0, perPage);
    const remaining = filtered.length - perPage;

    const lines = page.map(([code, name]) => `\`${code}\` — ${name}`);

    // Split into 2 columns
    const mid = Math.ceil(lines.length / 2);
    const col1 = lines.slice(0, mid).join('\n');
    const col2 = lines.slice(mid).join('\n');

    const container = new ContainerBuilder().setAccentColor(0x4285F4);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 🌐 Supported Languages (${filtered.length})`));

    if (search) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Showing results for: "${search}"`));
    }

    const colContent = col2 ? `${col1}\n\n${col2}` : col1;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(colContent));

    if (remaining > 0) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ...and ${remaining} more. Use /languages search:<query> to filter.`));
    }

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
