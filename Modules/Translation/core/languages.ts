import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { SUPPORTED_LANGUAGES } from '../helpers';

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
      await interaction.reply({ content: `No languages matching \`${search}\`.`, ephemeral: true });
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

    const embed = new EmbedBuilder()
      .setColor(0x4285F4)
      .setTitle(`🌐 Supported Languages (${filtered.length})`)
      .addFields(
        { name: '\u200b', value: col1, inline: true },
        { name: '\u200b', value: col2 || '\u200b', inline: true },
      );

    if (remaining > 0) {
      embed.setFooter({ text: `...and ${remaining} more. Use /languages search:<query> to filter.` });
    }

    if (search) {
      embed.setDescription(`Showing results for: "${search}"`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
