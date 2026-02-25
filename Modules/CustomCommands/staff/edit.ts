import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

export const editCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.edit',
  data: new SlashCommandBuilder()
    .setName('cedit')
    .setDescription('Edit an existing custom command')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Name of the custom command to edit')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('response')
        .setDescription('New response text')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('embed')
        .setDescription('Change embed response setting')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('cooldown')
        .setDescription('New cooldown in seconds')
        .setRequired(false)
        .setMinValue(0)
    )
    .addRoleOption(option =>
      option
        .setName('required_role')
        .setDescription('Required role (or none)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('dm')
        .setDescription('Send as DM')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('ephemeral')
        .setDescription('Send as ephemeral')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('delete_invocation')
        .setDescription('Delete command message')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reaction')
        .setDescription('Reaction emoji')
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
      const command = await helper.getCommand(interaction.guildId!, name);

      if (!command) {
        await interaction.reply({
          content: `Custom command "${name}" not found.`
        });
        return;
      }

      const updates: any = {};

      const response = interaction.options.getString('response');
      if (response) updates.response = response;

      const embed = interaction.options.getBoolean('embed');
      if (embed !== null) updates.embedResponse = embed;

      const cooldown = interaction.options.getInteger('cooldown');
      if (cooldown !== null) updates.cooldown = cooldown;

      const requiredRole = interaction.options.getRole('required_role');
      if (requiredRole) updates.requiredRoleId = requiredRole.id;

      const dm = interaction.options.getBoolean('dm');
      if (dm !== null) updates.dm = dm;

      const ephemeral = interaction.options.getBoolean('ephemeral');
      if (ephemeral !== null) updates.ephemeral = ephemeral;

      const deleteInvocation = interaction.options.getBoolean('delete_invocation');
      if (deleteInvocation !== null) updates.deleteInvocation = deleteInvocation;

      const reaction = interaction.options.getString('reaction');
      if (reaction) updates.addReaction = reaction;

      if (Object.keys(updates).length === 0) {
        await interaction.reply({
          content: 'No changes specified.'
        });
        return;
      }

      const updated = await helper.updateCommand(command.id, updates);

      const embed_response = new EmbedBuilder()
        .setTitle('Custom Command Updated')
        .setColor('#2f3136')
        .addFields(
          { name: 'Name', value: `\`${updated.name}\``, inline: true },
          { name: 'Changes', value: Object.keys(updates).join(', '), inline: false }
        );

      await interaction.reply({
        embeds: [embed_response]
      });

      logger.info(`Custom command edited: ${name} by ${interaction.user.id} in ${interaction.guildId!}`);
    } catch (error) {
      logger.error('Failed to edit custom command', error);
      await interaction.reply({
        content: 'Failed to edit custom command. Please try again later.'
      });
    }
  }
};

export default editCommand;
