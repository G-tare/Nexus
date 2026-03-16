import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getColorPalette,
  assignColor,
  canManageColors,
  hexToInt,
} from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorsetmember')
    .setDescription('Set a member\'s color for them')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to set the color for')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('The color to assign (name or number)')
        .setRequired(true)
        .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorsetmember',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const colors = await getColorPalette(interaction.guild!.id);

    const filtered = colors
      .filter(c =>
        c.name.toLowerCase().includes(focused) ||
        c.hex.toLowerCase().includes(focused) ||
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

    const target = interaction.options.getUser('user', true);
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

    const assigned = await assignColor(guild, target.id, color.id);
    if (!assigned) {
      await interaction.editReply({ content: `Failed to assign color to ${target.tag}. They may not be in the server.` });
      return;
    }

    const container = moduleContainer('color_roles').setAccentColor(hexToInt(color.hex));
    addText(container, `✅ Set **${target.tag}**'s color to **${color.name}** (\`#${color.hex}\`)`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
