import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import {
  getColorConfig,
  getColorPalette,
  canManageColors,
  ColorRolesConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorconfig')
    .setDescription('Configure color roles settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current color roles configuration'))
    .addSubcommand(sub =>
      sub.setName('joincolor')
        .setDescription('Set auto-assign color on join')
        .addStringOption(opt =>
          opt.setName('mode')
            .setDescription('Join color mode')
            .setRequired(true)
            .addChoices(
              { name: 'Disabled', value: 'disabled' },
              { name: 'Random', value: 'random' },
              { name: 'Specific Color', value: 'specific' },
            ))
        .addStringOption(opt =>
          opt.setName('color')
            .setDescription('Color name (only for "specific" mode)')))
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Restrict color commands to a specific channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to restrict to (leave empty to remove restriction)')
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('reactionmessages')
        .setDescription('Toggle DM notifications on reaction color assignment')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable reaction DMs')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('deleteresponses')
        .setDescription('Toggle auto-delete bot responses')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable auto-delete')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('delay')
            .setDescription('Delete delay in seconds (default 10)')
            .setMinValue(3)
            .setMaxValue(60)))
    .addSubcommand(sub =>
      sub.setName('overlapwarning')
        .setDescription('Toggle color overlap/similarity warnings')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable overlap warnings')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('threshold')
            .setDescription('Similarity threshold 0-100 (lower = more strict)')
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName('maxcolors')
        .setDescription('Set the maximum number of colors in the palette')
        .addIntegerOption(opt =>
          opt.setName('max')
            .setDescription('Maximum colors (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(sub =>
      sub.setName('managementrole')
        .setDescription('Add or remove a color management role')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role to add/remove as manager')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
            )))
    .addSubcommand(sub =>
      sub.setName('whitelist')
        .setDescription('Configure the color whitelist')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Enable', value: 'enable' },
              { name: 'Disable', value: 'disable' },
              { name: 'Add Role', value: 'add' },
              { name: 'Remove Role', value: 'remove' },
              { name: 'View', value: 'view' },
            ))
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Role for add/remove actions')))
    .addSubcommand(sub =>
      sub.setName('anchor')
        .setDescription('Set where color roles appear in the role hierarchy')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Anchor role (color roles go near this role)'))
        .addStringOption(opt =>
          opt.setName('position')
            .setDescription('Place color roles above or below the anchor')
            .addChoices(
              { name: 'Above', value: 'above' },
              { name: 'Below', value: 'below' },
            )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorconfig',
  premiumFeature: 'colorroles.management',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const config = await getColorConfig(guild.id);

    switch (sub) {
      case 'view': {
        const colors = await getColorPalette(guild.id);
        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🎨 Color Roles Configuration')
          .addFields(
            { name: 'Colors', value: `${colors.length}/${config.maxColors}`, inline: true },
            { name: 'Join Color', value: config.joinColor === null ? 'Disabled' : config.joinColor === 'random' ? 'Random' : `Color #${config.joinColor}`, inline: true },
            { name: 'Reaction DMs', value: config.reactionMessages ? 'On' : 'Off', inline: true },
            { name: 'Auto-Delete', value: config.deleteResponses ? `On (${config.deleteResponseDelay}s)` : 'Off', inline: true },
            { name: 'Overlap Warning', value: config.overlapWarning ? `On (threshold: ${config.overlapThreshold})` : 'Off', inline: true },
            { name: 'Command Channel', value: config.commandChannelId ? `<#${config.commandChannelId}>` : 'Any', inline: true },
            { name: 'Whitelist', value: config.whitelistEnabled ? `On (${config.whitelistRoleIds.length} roles)` : 'Off', inline: true },
            { name: 'Management Roles', value: config.managementRoleIds.length > 0 ? config.managementRoleIds.map(id => `<@&${id}>`).join(', ') : 'None (admin/manage roles only)', inline: false },
            { name: 'Role Anchor', value: config.colorRoleAnchorId ? `${config.colorRolePosition} <@&${config.colorRoleAnchorId}>` : 'Default position', inline: true },
          );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'joincolor': {
        const mode = interaction.options.getString('mode', true);
        let joinColor: null | 'random' | number = null;

        if (mode === 'random') {
          joinColor = 'random';
        } else if (mode === 'specific') {
          const colorName = interaction.options.getString('color');
          if (!colorName) {
            await interaction.reply({ content: 'You must specify a color name for specific mode.', ephemeral: true });
            return;
          }
          const colors = await getColorPalette(guild.id);
          const color = colors.find(c => c.name.toLowerCase() === colorName.toLowerCase());
          if (!color) {
            await interaction.reply({ content: `Color "${colorName}" not found.`, ephemeral: true });
            return;
          }
          joinColor = color.id;
        }

        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, joinColor });
        await interaction.reply({ content: `✅ Join color set to **${mode}**.`, ephemeral: true });
        break;
      }

      case 'channel': {
        const channel = interaction.options.getChannel('channel');
        const channelId = channel?.id || null;
        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, commandChannelId: channelId });
        await interaction.reply({
          content: channelId ? `✅ Color commands restricted to <#${channelId}>.` : '✅ Channel restriction removed.',
          ephemeral: true,
        });
        break;
      }

      case 'reactionmessages': {
        const enabled = interaction.options.getBoolean('enabled', true);
        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, reactionMessages: enabled });
        await interaction.reply({ content: `✅ Reaction DMs ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: true });
        break;
      }

      case 'deleteresponses': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const delay = interaction.options.getInteger('delay') || config.deleteResponseDelay;
        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, deleteResponses: enabled, deleteResponseDelay: delay });
        await interaction.reply({ content: `✅ Auto-delete ${enabled ? `enabled (${delay}s delay)` : 'disabled'}.`, ephemeral: true });
        break;
      }

      case 'overlapwarning': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const threshold = interaction.options.getInteger('threshold') || config.overlapThreshold;
        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, overlapWarning: enabled, overlapThreshold: threshold });
        await interaction.reply({ content: `✅ Overlap warning ${enabled ? `enabled (threshold: ${threshold})` : 'disabled'}.`, ephemeral: true });
        break;
      }

      case 'maxcolors': {
        const max = interaction.options.getInteger('max', true);
        await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, maxColors: max });
        await interaction.reply({ content: `✅ Max colors set to **${max}**.`, ephemeral: true });
        break;
      }

      case 'managementrole': {
        const role = interaction.options.getRole('role', true);
        const action = interaction.options.getString('action', true);
        const roles = [...config.managementRoleIds];

        if (action === 'add') {
          if (roles.includes(role.id)) {
            await interaction.reply({ content: 'That role is already a management role.', ephemeral: true });
            return;
          }
          roles.push(role.id);
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, managementRoleIds: roles });
          await interaction.reply({ content: `✅ <@&${role.id}> added as a color management role.`, ephemeral: true });
        } else {
          const idx = roles.indexOf(role.id);
          if (idx === -1) {
            await interaction.reply({ content: 'That role is not a management role.', ephemeral: true });
            return;
          }
          roles.splice(idx, 1);
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, managementRoleIds: roles });
          await interaction.reply({ content: `✅ <@&${role.id}> removed from color management roles.`, ephemeral: true });
        }
        break;
      }

      case 'whitelist': {
        const action = interaction.options.getString('action', true);
        const role = interaction.options.getRole('role');

        if (action === 'enable') {
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, whitelistEnabled: true });
          await interaction.reply({ content: '✅ Color whitelist enabled. Only whitelisted roles can use color commands.', ephemeral: true });
        } else if (action === 'disable') {
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, whitelistEnabled: false });
          await interaction.reply({ content: '✅ Color whitelist disabled. Everyone can use color commands.', ephemeral: true });
        } else if (action === 'add') {
          if (!role) { await interaction.reply({ content: 'You must specify a role to add.', ephemeral: true }); return; }
          const roles = [...config.whitelistRoleIds];
          if (roles.includes(role.id)) { await interaction.reply({ content: 'Role already whitelisted.', ephemeral: true }); return; }
          roles.push(role.id);
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, whitelistRoleIds: roles });
          await interaction.reply({ content: `✅ <@&${role.id}> added to whitelist.`, ephemeral: true });
        } else if (action === 'remove') {
          if (!role) { await interaction.reply({ content: 'You must specify a role to remove.', ephemeral: true }); return; }
          const roles = config.whitelistRoleIds.filter(id => id !== role.id);
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, whitelistRoleIds: roles });
          await interaction.reply({ content: `✅ <@&${role.id}> removed from whitelist.`, ephemeral: true });
        } else if (action === 'view') {
          const roleList = config.whitelistRoleIds.length > 0
            ? config.whitelistRoleIds.map(id => `<@&${id}>`).join(', ')
            : 'No roles whitelisted';
          await interaction.reply({
            content: `**Whitelist:** ${config.whitelistEnabled ? 'Enabled' : 'Disabled'}\n**Roles:** ${roleList}`,
            ephemeral: true,
          });
        }
        break;
      }

      case 'anchor': {
        const role = interaction.options.getRole('role');
        const position = interaction.options.getString('position') as 'above' | 'below' || 'below';

        if (!role) {
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, colorRoleAnchorId: null });
          await interaction.reply({ content: '✅ Role anchor removed. Color roles will use default positioning.', ephemeral: true });
        } else {
          await moduleConfig.setConfig(guild.id, 'colorroles', { ...config, colorRoleAnchorId: role.id, colorRolePosition: position });
          await interaction.reply({ content: `✅ Color roles will be placed **${position}** <@&${role.id}>.`, ephemeral: true });
        }
        break;
      }
    }
  },
};

export default command;
