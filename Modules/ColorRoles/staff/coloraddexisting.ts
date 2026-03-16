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
  addExistingRoleAsColor,
  getColorByName,
  getColorByRoleId,
  getColorPalette,
  getColorConfig,
  canManageColors,
  hexToInt,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coloraddexisting')
    .setDescription('Register an existing Discord role as a color role')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The existing role to use as a color')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Display name for the color (defaults to role name)')
        .setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloraddexisting',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const role = interaction.options.getRole('role', true);
    const name = interaction.options.getString('name')?.trim() || role.name;

    // Check if role is already registered
    const existingByRole = await getColorByRoleId(guild.id, role.id);
    if (existingByRole) {
      await interaction.reply({
        content: `That role is already registered as color **${existingByRole.name}**.`,
      });
      return;
    }

    // Check if name exists
    const existingByName = await getColorByName(guild.id, name);
    if (existingByName) {
      await interaction.reply({
        content: `A color named **${existingByName.name}** already exists.`,
      });
      return;
    }

    // Check limit
    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max).`,
      });
      return;
    }

    await interaction.deferReply();

    const fullRole = guild.roles.cache.get(role.id);
    if (!fullRole) {
      await interaction.editReply({ content: 'Could not find that role.' });
      return;
    }

    const color = await addExistingRoleAsColor({
      guild,
      role: fullRole,
      name,
      createdBy: interaction.user.id,
    });

    const hex = fullRole.hexColor.replace('#', '').toUpperCase() || '000000';

    const container = moduleContainer('color_roles').setAccentColor(hexToInt(hex));
    addText(container, `✅ Role <@&${role.id}> registered as color **${name}** (\`#${hex}\`)`);
    addFooter(container, 'This role will now appear in the color palette');

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
