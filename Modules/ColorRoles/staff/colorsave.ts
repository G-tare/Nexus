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
  savePalette,
  getSaves,
  getColorPalette,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorsave')
    .setDescription('Save the current color palette for backup')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for this save')
        .setRequired(true)
        .setMaxLength(64))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorsave',
  premiumFeature: 'colorroles.management',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    const colors = await getColorPalette(guild.id);

    if (colors.length === 0) {
      await interaction.reply({ content: 'No colors to save.' });
      return;
    }

    // Check save limit (max 20 saves per guild)
    const existingSaves = await getSaves(guild.id);
    if (existingSaves.length >= 20) {
      await interaction.reply({
        content: 'You\'ve reached the maximum of 20 saves. Delete some old saves first.',
      });
      return;
    }

    await interaction.deferReply();

    const save = await savePalette(guild.id, name, interaction.user.id);

    const container = moduleContainer('color_roles').setAccentColor(0x2ECC71);
    addText(container, `### 💾 Palette Saved`);
    addText(container,
      `Saved **${colors.length}** colors as **"${name}"**\n` +
      `Save ID: \`${save.id}\`\n\n` +
      `Use \`/colorrestore ${save.id}\` to restore this palette.`
    );
    addFooter(container, `${existingSaves.length + 1}/20 saves used`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
