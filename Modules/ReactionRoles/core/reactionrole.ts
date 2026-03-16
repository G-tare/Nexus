import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
  Role,
  MessageFlags } from 'discord.js';
import { moduleContainer, addText, addFields, v2Payload, successReply } from '../../../Shared/src/utils/componentsV2';
import {
  RRType,
  RRMode,
  RRPanel,
  getReactionRolesConfig,
  saveReactionRolesConfig,
  createPanel,
  createRoleIfNotExists,
} from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a new reaction role panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Panel type')
        .setRequired(true)
        .addChoices(
          { name: 'Reaction', value: 'reaction' },
          { name: 'Button', value: 'button' },
          { name: 'Dropdown', value: 'dropdown' },
        ),
    )
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Role mode')
        .setRequired(true)
        .addChoices(
          { name: 'Normal', value: 'normal' },
          { name: 'Unique', value: 'unique' },
          { name: 'Verify', value: 'verify' },
          { name: 'Drop', value: 'drop' },
        ),
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to post the panel in')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Panel title')
        .setRequired(true)
        .setMaxLength(256),
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Panel description')
        .setRequired(false)
        .setMaxLength(4000),
    )
    .addStringOption(option =>
      option
        .setName('color')
        .setDescription('Embed color (hex code)')
        .setRequired(false),
    )
    .addIntegerOption(option =>
      option
        .setName('max-roles')
        .setDescription('Max roles per user (0 = unlimited)')
        .setRequired(false)
        .setMinValue(0),
    )
    .addRoleOption(option =>
      option
        .setName('role1')
        .setDescription('First role')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('emoji1')
        .setDescription('Emoji for role1')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('label1')
        .setDescription('Label for role1')
        .setRequired(false),
    )
    .addRoleOption(option =>
      option
        .setName('role2')
        .setDescription('Second role')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('emoji2')
        .setDescription('Emoji for role2')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('label2')
        .setDescription('Label for role2')
        .setRequired(false),
    )
    .addRoleOption(option =>
      option
        .setName('role3')
        .setDescription('Third role')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('emoji3')
        .setDescription('Emoji for role3')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('label3')
        .setDescription('Label for role3')
        .setRequired(false),
    )
    .addRoleOption(option =>
      option
        .setName('role4')
        .setDescription('Fourth role')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('emoji4')
        .setDescription('Emoji for role4')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('label4')
        .setDescription('Label for role4')
        .setRequired(false),
    )
    .addRoleOption(option =>
      option
        .setName('role5')
        .setDescription('Fifth role')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('emoji5')
        .setDescription('Emoji for role5')
        .setRequired(false),
    )
    .addStringOption(option =>
      option
        .setName('label5')
        .setDescription('Label for role5')
        .setRequired(false),
    ),

  module: 'reactionroles',
  permissionPath: 'reactionroles.reactionrole',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const type = interaction.options.getString('type') as RRType;
    const mode = interaction.options.getString('mode') as RRMode;
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title')!;
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color');
    const maxRoles = interaction.options.getInteger('max-roles') || 0;

    if (!(channel instanceof TextChannel)) {
      return interaction.editReply('❌ Channel must be a text channel.');
    }

    try {
      // Collect roles from options
      const roles: RRPanel['roles'] = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) {
          const emoji = interaction.options.getString(`emoji${i}`);
          const label = interaction.options.getString(`label${i}`);
          roles.push({
            roleId: role.id,
            emoji: emoji || undefined,
            label: label || undefined,
          });
        }
      }

      const panel = await createPanel(interaction.guild, channel, {
        type,
        mode,
        title,
        description: description || undefined,
        color: color || undefined,
        roles,
        maxRoles,
        dmConfirmation: false,
      });

      const config = await getReactionRolesConfig(interaction.guildId!);
      config.panels.push(panel);
      await saveReactionRolesConfig(interaction.guildId!, config);

      const container = moduleContainer('reaction_roles');
      addText(container, `### ✅ Reaction Role Panel Created`);
      addFields(container, [
        { name: 'Panel ID', value: panel.id, inline: true },
        { name: 'Type', value: type, inline: true },
        { name: 'Mode', value: mode, inline: true },
        { name: 'Channel', value: `<#${panel.channelId}>`, inline: true },
        { name: 'Roles Added', value: roles.length.toString(), inline: true },
        {
          name: 'Next Steps',
          value: `Use \`/rr-edit add-role\` to add more roles with panel ID: \`${panel.id}\``,
          inline: false,
        },
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error creating reaction role panel:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
