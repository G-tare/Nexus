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
  exportPalette,
  getColorPalette,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorexport')
    .setDescription('Generate an export code to share your palette with other servers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorexport',
  premiumFeature: 'colorroles.management',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({ content: 'No colors to export.' });
      return;
    }

    const code = await exportPalette(guild.id);

    const container = moduleContainer('color_roles').setAccentColor(0x3498DB);
    addText(container, `### 📤 Color Palette Export`);
    addText(container,
      `Exporting **${colors.length}** colors.\n\n` +
      `Share this code with another server that has the bot. They can use \`/colorimport\` to import it.\n\n` +
      `**Export Code:**\n\`\`\`\n${code}\n\`\`\``
    );
    addFooter(container, 'This code contains color names and hex values only — no roles are transferred');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
