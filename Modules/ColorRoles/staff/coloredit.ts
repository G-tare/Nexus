import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  validateHex,
  hexToInt,
  editColor,
  getColorPalette,
  getColorByName,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coloredit')
    .setDescription('Edit an existing color\'s name or hex value')
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('The color to edit (name or number)')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(opt =>
      opt.setName('new_name')
        .setDescription('New name for the color')
        .setMaxLength(32))
    .addStringOption(opt =>
      opt.setName('new_hex')
        .setDescription('New hex color code'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloredit',
  premiumFeature: 'colorroles.management',
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

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const colorInput = interaction.options.getString('color', true);
    const newName = interaction.options.getString('new_name')?.trim();
    const newHexInput = interaction.options.getString('new_hex');

    if (!newName && !newHexInput) {
      await interaction.reply({
        content: 'You must provide at least a new name or new hex value.',
        ephemeral: true,
      });
      return;
    }

    // Validate new hex if provided
    let newHex: string | undefined;
    if (newHexInput) {
      newHex = validateHex(newHexInput) || undefined;
      if (!newHex) {
        await interaction.reply({ content: 'Invalid hex color code.', ephemeral: true });
        return;
      }
    }

    // Find the color
    const colors = await getColorPalette(guild.id);
    let color = colors.find(c => c.name.toLowerCase() === colorInput.toLowerCase());
    if (!color) {
      const num = parseInt(colorInput);
      if (!isNaN(num)) color = colors.find(c => c.position === num);
    }

    if (!color) {
      await interaction.reply({ content: `Color "${colorInput}" not found.`, ephemeral: true });
      return;
    }

    // Check new name doesn't conflict
    if (newName) {
      const conflict = colors.find(c => c.name.toLowerCase() === newName.toLowerCase() && c.id !== color!.id);
      if (conflict) {
        await interaction.reply({
          content: `A color named **${conflict.name}** already exists.`,
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply();

    const updated = await editColor({
      guild,
      colorId: color.id,
      newName,
      newHex,
    });

    if (!updated) {
      await interaction.editReply({ content: 'Failed to edit the color.' });
      return;
    }

    const displayHex = newHex || color.hex;

    const embed = new EmbedBuilder()
      .setColor(hexToInt(displayHex))
      .setDescription(
        `✅ Color updated!\n` +
        (newName ? `**Name:** ${color.name} → ${newName}\n` : '') +
        (newHex ? `**Hex:** \`#${color.hex}\` → \`#${newHex}\`\n` : '')
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
