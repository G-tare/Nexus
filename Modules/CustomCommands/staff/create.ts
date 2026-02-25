import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

export const createCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.create',
  data: new SlashCommandBuilder()
    .setName('ccreate')
    .setDescription('Create a custom command')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the custom command')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('response')
        .setDescription('Response text for the command')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('embed')
        .setDescription('Send response as an embed')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('cooldown')
        .setDescription('Cooldown in seconds (0 = no cooldown)')
        .setRequired(false)
        .setMinValue(0)
    )
    .addRoleOption(option =>
      option
        .setName('required_role')
        .setDescription('Role required to use this command')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('dm')
        .setDescription('Send response as DM instead of in channel')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('ephemeral')
        .setDescription('Send as ephemeral (only visible to user)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('delete_invocation')
        .setDescription('Delete the command message after execution')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reaction')
        .setDescription('Emoji to react with (optional)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  async execute(interaction: ChatInputCommandInteraction, helpers: any) {
    const helper = helpers.customcommands as CustomCommandsHelper;

    if (!interaction.guild || !interaction.member) {
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
      const name = interaction.options.getString('name', true).toLowerCase();
      const response = interaction.options.getString('response', true);
      const embed = interaction.options.getBoolean('embed') || false;
      const cooldown = interaction.options.getInteger('cooldown') || 0;
      const requiredRole = interaction.options.getRole('required_role');
      const dm = interaction.options.getBoolean('dm') || false;
      const ephemeral = interaction.options.getBoolean('ephemeral') || false;
      const deleteInvocation = interaction.options.getBoolean('delete_invocation') || false;
      const reaction = interaction.options.getString('reaction') || undefined;

      // Check guild command limit
      const config = await helper.getGuildConfig(interaction.guildId!);
      const guildCommands = await helper.getGuildCommands(interaction.guildId!);

      if (guildCommands.length >= (config.maxCommands || 50)) {
        await interaction.reply({
          content: `You have reached the maximum number of custom commands (${config.maxCommands || 50}).`
        });
        return;
      }

      // Check if command already exists
      const existing = await helper.getCommand(interaction.guildId!, name);
      if (existing) {
        await interaction.reply({
          content: `A custom command named "${name}" already exists. Use \`/cedit\` to modify it.`
        });
        return;
      }

      // Create the command
      const command = await helper.createCommand(
        interaction.guildId!,
        name,
        response,
        interaction.user.id,
        {
          embedResponse: embed,
          cooldown: cooldown,
          requiredRoleId: requiredRole?.id,
          dm: dm,
          ephemeral: ephemeral,
          deleteInvocation: deleteInvocation,
          addReaction: reaction
        }
      );

      const embed_response = new EmbedBuilder()
        .setTitle('Custom Command Created')
        .setColor('#2f3136')
        .addFields(
          { name: 'Name', value: `\`${command.name}\``, inline: true },
          { name: 'Response Type', value: embed ? 'Embed' : 'Text', inline: true },
          { name: 'Cooldown', value: cooldown > 0 ? `${cooldown}s` : 'None', inline: true },
          { name: 'Response Preview', value: response.substring(0, 100) + (response.length > 100 ? '...' : ''), inline: false }
        );

      if (requiredRole) {
        embed_response.addFields(
          { name: 'Required Role', value: requiredRole.toString(), inline: true }
        );
      }

      await interaction.reply({
        embeds: [embed_response]
      });

      logger.info(`Custom command created: ${name} by ${interaction.user.id} in ${interaction.guildId!}`);
    } catch (error) {
      logger.error('Failed to create custom command', error);
      await interaction.reply({
        content: 'Failed to create custom command. Please try again later.'
      });
    }
  }
};

export default createCommand;
