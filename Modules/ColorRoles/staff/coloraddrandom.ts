import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
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
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max).`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const hex = randomHex();
    const name = interaction.options.getString('name')?.trim() || `Random #${hex.slice(0, 4)}`;

    await addColor({ guild, name, hex, createdBy: interaction.user.id });

    const embed = new EmbedBuilder()
      .setColor(hexToInt(hex))
      .setDescription(`🎲 Random color **${name}** (\`#${hex}\`) added!`)
      .setFooter({ text: `Color #${colors.length + 1}` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
