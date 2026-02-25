import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
  Role,
  EmbedBuilder, MessageFlags } from 'discord.js';
import {
  createPanel,
  getReactionRolesConfig,
  saveReactionRolesConfig,
  RRRole,
} from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-button')
    .setDescription('Create a quick button-based reaction role panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
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
    .addRoleOption(option =>
      option
        .setName('role1')
        .setDescription('First role')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('label1')
        .setDescription('Label for role1')
        .setRequired(true),
    )
    .addRoleOption(option =>
      option
        .setName('role2')
        .setDescription('Second role')
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
        .setName('label5')
        .setDescription('Label for role5')
        .setRequired(false),
    ),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-button',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title')!;

    if (!(channel instanceof TextChannel)) {
      return interaction.editReply('❌ Channel must be a text channel.');
    }

    try {
      // Collect roles
      const roles: RRRole[] = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        const label = interaction.options.getString(`label${i}`);

        if (role && label) {
          roles.push({
            roleId: role.id,
            label,
          });
        }
      }

      if (roles.length === 0) {
        return interaction.editReply('❌ You must provide at least one role.');
      }

      const panel = await createPanel(interaction.guild, channel, {
        type: 'button',
        mode: 'normal',
        title,
        roles,
        maxRoles: 0,
        dmConfirmation: false,
      });

      const config = await getReactionRolesConfig(interaction.guildId!);
      config.panels.push(panel);
      await saveReactionRolesConfig(interaction.guildId!, config);

      const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('✅ Button Panel Created')
        .addFields(
          { name: 'Panel ID', value: panel.id, inline: true },
          { name: 'Channel', value: `<#${panel.channelId}>`, inline: true },
          { name: 'Roles', value: roles.length.toString(), inline: true },
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error creating button panel:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
