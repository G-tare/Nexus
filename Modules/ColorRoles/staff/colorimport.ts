import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  importPalette,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorimport')
    .setDescription('Import a color palette from an export code')
    .addStringOption(opt =>
      opt.setName('code')
        .setDescription('The export code from /colorexport')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorimport',
  premiumFeature: 'colorroles.management',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const code = interaction.options.getString('code', true).trim();

    await interaction.deferReply();

    const count = await importPalette(guild, code, interaction.user.id);

    if (count === 0) {
      await interaction.editReply({
        content: '❌ Failed to import. The code may be invalid or all colors already exist.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('📥 Palette Imported')
      .setDescription(
        `Successfully imported **${count}** colors!\n` +
        `Use \`/colorlist\` to see the full palette.`
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
