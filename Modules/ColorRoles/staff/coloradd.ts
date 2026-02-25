import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  validateHex,
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
    .setName('coloradd')
    .setDescription('Add a new color to the server palette')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for the color')
        .setRequired(true)
        .setMaxLength(32))
    .addStringOption(opt =>
      opt.setName('hex')
        .setDescription('Hex color code (e.g. FF69B4 or #FF69B4)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloradd',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    // Permission check
    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    const hexInput = interaction.options.getString('hex', true);

    // Validate hex
    const hex = validateHex(hexInput);
    if (!hex) {
      await interaction.reply({
        content: 'Invalid hex color. Use a 6-digit hex code like `FF69B4` or `#FF69B4`.',
      });
      return;
    }

    // Check if name exists
    const existing = await getColorByName(guild.id, name);
    if (existing) {
      await interaction.reply({
        content: `A color named **${existing.name}** already exists.`,
      });
      return;
    }

    // Check limit
    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max). Remove some colors first.`,
      });
      return;
    }

    await interaction.deferReply();

    // Overlap warning
    let warning = '';
    if (config.overlapWarning) {
      const similar = await findSimilarColor(guild.id, hex, config.overlapThreshold);
      if (similar) {
        warning = `\n⚠️ This color is similar to **${similar.name}** (\`#${similar.hex}\`)`;
      }
    }

    // Add the color
    const color = await addColor({
      guild,
      name,
      hex,
      createdBy: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setColor(hexToInt(hex))
      .setDescription(`✅ Color **${name}** (\`#${hex}\`) has been added to the palette!${warning}`)
      .setFooter({ text: `Color #${colors.length + 1} • Role created` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
