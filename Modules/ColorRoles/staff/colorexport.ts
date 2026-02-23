import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  exportPalette,
  getColorPalette,
  canManageColors,
} from '../helpers';

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
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({ content: 'No colors to export.', ephemeral: true });
      return;
    }

    const code = await exportPalette(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('📤 Color Palette Export')
      .setDescription(
        `Exporting **${colors.length}** colors.\n\n` +
        `Share this code with another server that has the bot. They can use \`/colorimport\` to import it.\n\n` +
        `**Export Code:**\n\`\`\`\n${code}\n\`\`\``
      )
      .setFooter({ text: 'This code contains color names and hex values only — no roles are transferred' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
