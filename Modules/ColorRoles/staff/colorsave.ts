import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  savePalette,
  getSaves,
  getColorPalette,
  canManageColors,
} from '../helpers';

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
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    const colors = await getColorPalette(guild.id);

    if (colors.length === 0) {
      await interaction.reply({ content: 'No colors to save.', ephemeral: true });
      return;
    }

    // Check save limit (max 20 saves per guild)
    const existingSaves = await getSaves(guild.id);
    if (existingSaves.length >= 20) {
      await interaction.reply({
        content: 'You\'ve reached the maximum of 20 saves. Delete some old saves first.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const save = await savePalette(guild.id, name, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('💾 Palette Saved')
      .setDescription(
        `Saved **${colors.length}** colors as **"${name}"**\n` +
        `Save ID: \`${save.id}\`\n\n` +
        `Use \`/colorrestore ${save.id}\` to restore this palette.`
      )
      .setFooter({ text: `${existingSaves.length + 1}/20 saves used` });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
