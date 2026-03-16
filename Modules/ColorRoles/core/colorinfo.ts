import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getColorPalette,
  getColorMemberCount,
  hexToInt,
  hexToRgb,
} from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorinfo')
    .setDescription('View details about a specific color')
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('The color to view (name or number)')
        .setRequired(true)
        .setAutocomplete(true)
    ) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorinfo',
  premiumFeature: 'colorroles.basic',
  cooldown: 3,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const colors = await getColorPalette(interaction.guild!.id);

    const filtered = colors
      .filter(c =>
        c.name.toLowerCase().includes(focused) ||
        c.hex.toLowerCase().includes(focused) ||
        String(c.position).includes(focused)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(c => ({
        name: `${c.position}. ${c.name} (#${c.hex})`,
        value: c.name,
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const colorInput = interaction.options.getString('color', true);

    const colors = await getColorPalette(guild.id);
    let color = colors.find(c => c.name.toLowerCase() === colorInput.toLowerCase());
    if (!color) {
      const num = parseInt(colorInput);
      if (!isNaN(num)) {
        color = colors.find(c => c.position === num);
      }
    }

    if (!color) {
      await interaction.reply({
        content: `Color "${colorInput}" not found. Use \`/colorlist\` to see available colors.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rgb = hexToRgb(color.hex);
    const memberCount = await getColorMemberCount(guild, color.roleId);

    const container = moduleContainer('color_roles').setAccentColor(hexToInt(color.hex));
    addText(container, `### 🎨 ${color.name}`);
    addFields(container, [
      { name: 'Hex', value: `\`#${color.hex}\``, inline: true },
      { name: 'RGB', value: `\`${rgb.r}, ${rgb.g}, ${rgb.b}\``, inline: true },
      { name: 'Position', value: `#${color.position}`, inline: true },
      { name: 'Members', value: `${memberCount}`, inline: true },
      { name: 'Role', value: `<@&${color.roleId}>`, inline: true },
      { name: 'Added By', value: color.createdBy === 'system' ? 'System' : `<@${color.createdBy}>`, inline: true },
    ]);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
