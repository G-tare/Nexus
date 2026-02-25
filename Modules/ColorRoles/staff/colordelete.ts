import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  deleteColor,
  getColorPalette,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colordelete')
    .setDescription('Remove a color from the server palette')
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('The color to delete (name or number)')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colordelete',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const colors = await getColorPalette(interaction.guild!.id);

    const filtered = colors
      .filter(c =>
        c.name.toLowerCase().includes(focused) ||
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
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const colorInput = interaction.options.getString('color', true);

    // Find the color
    const colors = await getColorPalette(guild.id);
    let color = colors.find(c => c.name.toLowerCase() === colorInput.toLowerCase());
    if (!color) {
      const num = parseInt(colorInput);
      if (!isNaN(num)) color = colors.find(c => c.position === num);
    }

    if (!color) {
      await interaction.reply({ content: `Color "${colorInput}" not found.` });
      return;
    }

    await interaction.deferReply();

    const deleted = await deleteColor(guild, color.id);
    if (!deleted) {
      await interaction.editReply({ content: 'Failed to delete the color.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setDescription(`🗑️ Color **${color.name}** (\`#${color.hex}\`) has been removed. The role has been deleted.`);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
