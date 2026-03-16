import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  randomHex,
  hexToInt,
  addColor,
  getColorPalette,
  getColorConfig,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coloraddrandom')
    .setDescription('Add a randomly generated color to the palette')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for the color (optional — auto-generated if omitted)')
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloraddrandom',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max).`,
      });
      return;
    }

    await interaction.deferReply();

    const hex = randomHex();
    const name = interaction.options.getString('name')?.trim() || `Random #${hex.slice(0, 4)}`;

    await addColor({ guild, name, hex, createdBy: interaction.user.id });

    const container = moduleContainer('color_roles').setAccentColor(hexToInt(hex));
    addText(container, `🎲 Random color **${name}** (\`#${hex}\`) added!`);
    addFooter(container, `Color #${colors.length + 1}`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
