import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import {
  getReactionRolesConfig,
  saveReactionRolesConfig,
  ReactionRolesConfig,
  RRMode,
  RRType,
} from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-config')
    .setDescription('Manage reaction role settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current settings'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('default-mode')
        .setDescription('Set default role mode')
        .addStringOption(option =>
          option
            .setName('mode')
            .setDescription('Default mode')
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
        .setName('default-type')
        .setDescription('Set default panel type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Default type')
            .setRequired(true)
            .addChoices(
              { name: 'Reaction', value: 'reaction' },
              { name: 'Button', value: 'button' },
              { name: 'Dropdown', value: 'dropdown' },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('dm-confirmation')
        .setDescription('Toggle DM confirmations for new panels')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('log-channel')
        .setDescription('Set channel for role action logs')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Log channel')
            .setRequired(true),
        ),
    ),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-config',
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
    const config = await getReactionRolesConfig(interaction.guildId!);

    try {
      if (subcommand === 'view') {
        const logChannel = config.logChannelId
          ? `<#${config.logChannelId}>`
          : 'Not set';

        const embed = new EmbedBuilder()
          .setColor('#2F3136')
          .setTitle('⚙️ Reaction Role Settings')
          .addFields(
            { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
            { name: 'Default Mode', value: config.defaultMode, inline: true },
            { name: 'Default Type', value: config.defaultType, inline: true },
            { name: 'DM Confirmation', value: config.dmConfirmation ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Log Channel', value: logChannel, inline: true },
            { name: 'Total Panels', value: config.panels.length.toString(), inline: true },
          );

        return interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'default-mode') {
        const mode = interaction.options.getString('mode') as RRMode;
        config.defaultMode = mode;
        await saveReactionRolesConfig(interaction.guildId!, config);

        return interaction.editReply(`✅ Default mode set to **${mode}**.`);
      } else if (subcommand === 'default-type') {
        const type = interaction.options.getString('type') as RRType;
        config.defaultType = type;
        await saveReactionRolesConfig(interaction.guildId!, config);

        return interaction.editReply(`✅ Default type set to **${type}**.`);
      } else if (subcommand === 'dm-confirmation') {
        const enabled = interaction.options.getBoolean('enabled')!;
        config.dmConfirmation = enabled;
        await saveReactionRolesConfig(interaction.guildId!, config);

        return interaction.editReply(
          `✅ DM confirmation ${enabled ? 'enabled' : 'disabled'} for new panels.`,
        );
      } else if (subcommand === 'log-channel') {
        const channel = interaction.options.getChannel('channel');

        if (!(channel instanceof TextChannel)) {
          return interaction.editReply('❌ Channel must be a text channel.');
        }

        config.logChannelId = channel.id;
        await saveReactionRolesConfig(interaction.guildId!, config);

        return interaction.editReply(`✅ Log channel set to <#${channel.id}>.`);
      }
    } catch (error) {
      console.error('Error updating config:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
