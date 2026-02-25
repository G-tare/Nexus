import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  rgbToHex,
  hexToInt,
  addColor,
  getColorByName,
  getColorPalette,
  getColorConfig,
  findSimilarColor,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coloraddrgb')
    .setDescription('Add a new color using RGB values')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for the color')
        .setRequired(true)
        .setMaxLength(32))
    .addIntegerOption(opt =>
      opt.setName('r')
        .setDescription('Red value (0-255)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(255))
    .addIntegerOption(opt =>
      opt.setName('g')
        .setDescription('Green value (0-255)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(255))
    .addIntegerOption(opt =>
      opt.setName('b')
        .setDescription('Blue value (0-255)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(255))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloraddrgb',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    const r = interaction.options.getInteger('r', true);
    const g = interaction.options.getInteger('g', true);
    const b = interaction.options.getInteger('b', true);

    const hex = rgbToHex(r, g, b);
    if (!hex) {
      await interaction.reply({ content: 'Invalid RGB values.' });
      return;
    }

    // Check if name exists
    const existing = await getColorByName(guild.id, name);
    if (existing) {
      await interaction.reply({ content: `A color named **${existing.name}** already exists.` });
      return;
    }

    // Check limit
    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max).`,
      });
      return;
    }

    await interaction.deferReply();

    // Overlap warning
    let warning = '';
    if (config.overlapWarning) {
      const similar = await findSimilarColor(guild.id, hex, config.overlapThreshold);
      if (similar) {
        warning = `\n⚠️ Similar to **${similar.name}** (\`#${similar.hex}\`)`;
      }
    }

    await addColor({ guild, name, hex, createdBy: interaction.user.id });

    const embed = new EmbedBuilder()
      .setColor(hexToInt(hex))
      .setDescription(`✅ Color **${name}** (\`rgb(${r}, ${g}, ${b})\` / \`#${hex}\`) added!${warning}`)
      .setFooter({ text: `Color #${colors.length + 1} • Role created` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
