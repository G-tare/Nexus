import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  Role,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getReactionRolesConfig,
  saveReactionRolesConfig,
  getPanelById,
  updatePanelMessage,
  createRoleIfNotExists,
  RRMode,
  RRRole,
} from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-edit')
    .setDescription('Edit a reaction role panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-role')
        .setDescription('Add a role to a panel')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Role to add')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('Emoji for the role')
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName('label')
            .setDescription('Label for the role')
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Description for the role (dropdown only)')
            .setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-role')
        .setDescription('Remove a role from a panel')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Role to remove')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('create-role')
        .setDescription('Create a new role and add to panel')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Role name')
            .setRequired(true)
            .setMaxLength(100),
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Role color (hex code)')
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('Emoji for the role')
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName('label')
            .setDescription('Label for the role')
            .setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-mode')
        .setDescription('Change panel mode')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('mode')
            .setDescription('New mode')
            .setRequired(true)
            .addChoices(
              { name: 'Normal', value: 'normal' },
              { name: 'Unique', value: 'unique' },
              { name: 'Verify', value: 'verify' },
              { name: 'Drop', value: 'drop' },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-title')
        .setDescription('Change panel title')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('New title')
            .setRequired(true)
            .setMaxLength(256),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-description')
        .setDescription('Change panel description')
        .addStringOption(option =>
          option
            .setName('panel-id')
            .setDescription('Panel ID')
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('New description')
            .setRequired(true)
            .setMaxLength(4000),
        ),
    ),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-edit',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const panelId = interaction.options.getString('panel-id');
    const config = await getReactionRolesConfig(interaction.guildId!);
    const panel = getPanelById(config, panelId!);

    if (!panel) {
      return interaction.editReply('❌ Panel not found.');
    }

    try {
      if (subcommand === 'add-role') {
        const role = interaction.options.getRole('role') as Role;
        const emoji = interaction.options.getString('emoji');
        const label = interaction.options.getString('label');
        const description = interaction.options.getString('description');

        if (panel.roles.length >= 25) {
          return interaction.editReply('❌ Panel already has max roles (25).');
        }

        if (panel.roles.some(r => r.roleId === role.id)) {
          return interaction.editReply('❌ This role is already in the panel.');
        }

        const newRole: RRRole = {
          roleId: role.id,
          emoji: emoji || undefined,
          label: label || undefined,
          description: description || undefined,
        };

        panel.roles.push(newRole);
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(`✅ Added <@&${role.id}> to the panel.`);
      } else if (subcommand === 'remove-role') {
        const role = interaction.options.getRole('role') as Role;

        const roleIndex = panel.roles.findIndex(r => r.roleId === role.id);
        if (roleIndex === -1) {
          return interaction.editReply('❌ This role is not in the panel.');
        }

        panel.roles.splice(roleIndex, 1);
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(`✅ Removed <@&${role.id}> from the panel.`);
      } else if (subcommand === 'create-role') {
        const name = interaction.options.getString('name')!;
        const color = interaction.options.getString('color');
        const emoji = interaction.options.getString('emoji');
        const label = interaction.options.getString('label');

        const newDiscordRole = await createRoleIfNotExists(interaction.guild, name, color || undefined);

        if (panel.roles.some(r => r.roleId === newDiscordRole.id)) {
          return interaction.editReply('❌ This role is already in the panel.');
        }

        if (panel.roles.length >= 25) {
          return interaction.editReply('❌ Panel already has max roles (25).');
        }

        const newRole: RRRole = {
          roleId: newDiscordRole.id,
          emoji: emoji || undefined,
          label: label || undefined,
        };

        panel.roles.push(newRole);
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(
          `✅ Created role <@&${newDiscordRole.id}> and added it to the panel.`,
        );
      } else if (subcommand === 'set-mode') {
        const mode = interaction.options.getString('mode') as RRMode;
        panel.mode = mode;
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(`✅ Panel mode changed to **${mode}**.`);
      } else if (subcommand === 'set-title') {
        const title = interaction.options.getString('title')!;
        panel.title = title;
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(`✅ Panel title updated.`);
      } else if (subcommand === 'set-description') {
        const description = interaction.options.getString('description')!;
        panel.description = description;
        await saveReactionRolesConfig(interaction.guildId!, config);
        await updatePanelMessage(interaction.guild, panel);

        interaction.editReply(`✅ Panel description updated.`);
      }
    } catch (error) {
      console.error('Error editing panel:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
