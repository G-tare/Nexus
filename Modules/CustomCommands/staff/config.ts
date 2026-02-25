import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

export const configCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.config',
  data: new SlashCommandBuilder()
    .setName('cconfig')
    .setDescription('Configure custom commands settings for this server')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Update configuration')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable custom commands')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('prefix')
            .setDescription('Set the prefix for custom commands')
            .setRequired(false)
            .setMaxLength(5)
        )
        .addIntegerOption(option =>
          option
            .setName('max_commands')
            .setDescription('Maximum number of custom commands allowed')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(500)
        )
        .addBooleanOption(option =>
          option
            .setName('allow_slash')
            .setDescription('Allow registering commands as slash commands')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  async execute(interaction: ChatInputCommandInteraction, helpers: any) {
    const helper = helpers.customcommands as CustomCommandsHelper;

    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.'
      });
      return;
    }

    // Check permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the "Manage Guild" permission to use this command.'
      });
      return;
    }

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'view') {
        const config = await helper.getGuildConfig(interaction.guildId!);
        const commandCount = (await helper.getGuildCommands(interaction.guildId!)).length;

        const embed = new EmbedBuilder()
          .setTitle('Custom Commands Configuration')
          .setColor('#2f3136')
          .addFields(
            { name: 'Status', value: config.enabled ? 'Enabled' : 'Disabled', inline: true },
            { name: 'Prefix', value: `\`${config.prefix}\``, inline: true },
            { name: 'Max Commands', value: String(config.maxCommands), inline: true },
            { name: 'Slash Commands', value: config.allowSlash ? 'Allowed' : 'Disabled', inline: true },
            { name: 'Commands Created', value: String(commandCount), inline: true },
            { name: 'Slots Available', value: String(Math.max(0, config.maxCommands - commandCount)), inline: true }
          )
          .setFooter({ text: 'Use /cconfig set to modify these settings' });

        await interaction.reply({
          embeds: [embed]
        });
      } else if (subcommand === 'set') {
        const enabled = interaction.options.getBoolean('enabled');
        const prefix = interaction.options.getString('prefix');
        const maxCommands = interaction.options.getInteger('max_commands');
        const allowSlash = interaction.options.getBoolean('allow_slash');

        const updates: any = {};

        if (enabled !== null) updates.enabled = enabled;
        if (prefix) updates.prefix = prefix;
        if (maxCommands !== null) updates.maxCommands = maxCommands;
        if (allowSlash !== null) updates.allowSlash = allowSlash;

        if (Object.keys(updates).length === 0) {
          await interaction.reply({
            content: 'No changes specified.'
          });
          return;
        }

        const updated = await helper.updateGuildConfig(interaction.guildId!, updates);

        const embed = new EmbedBuilder()
          .setTitle('Configuration Updated')
          .setColor('#2f3136')
          .addFields(
            { name: 'Changes Made', value: Object.keys(updates).join(', '), inline: false }
          );

        if (updates.enabled !== undefined) {
          embed.addFields({ name: 'Status', value: updates.enabled ? 'Enabled' : 'Disabled', inline: true });
        }
        if (updates.prefix) {
          embed.addFields({ name: 'New Prefix', value: `\`${updates.prefix}\``, inline: true });
        }
        if (updates.maxCommands) {
          embed.addFields({ name: 'Max Commands', value: String(updates.maxCommands), inline: true });
        }
        if (updates.allowSlash !== undefined) {
          embed.addFields({ name: 'Slash Commands', value: updates.allowSlash ? 'Allowed' : 'Disabled', inline: true });
        }

        await interaction.reply({
          embeds: [embed]
        });

        logger.info(`Custom commands config updated in ${interaction.guildId!} by ${interaction.user.id}`);
      }
    } catch (error) {
      logger.error('Failed to configure custom commands', error);
      await interaction.reply({
        content: 'Failed to update configuration. Please try again later.'
      });
    }
  }
};

export default configCommand;
