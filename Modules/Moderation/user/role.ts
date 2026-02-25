import {  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, Role, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.role',
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a user')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Add or remove role')
        .setRequired(true)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        )
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to modify roles for')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Role to add or remove')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const action = interaction.options.getString('action', true) as 'add' | 'remove';
    const targetUser = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true) as Role;

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Check if bot can manage this role
      const botMember = await guild.members.fetchMe();
      if (botMember.roles.highest.position <= role.position) {
        await interaction.editReply({
          embeds: [errorEmbed('I cannot manage this role - it is equal to or higher than my highest role')]
        });
        return;
      }

      if (action === 'add') {
        if (targetMember.roles.cache.has(role.id)) {
          await interaction.editReply({
            embeds: [errorEmbed(`${targetUser.tag} already has the ${role.name} role`)]
          });
          return;
        }
        await targetMember.roles.add(role);
        const embed = successEmbed(`Added ${role.name} to ${targetUser.tag}`);
        await interaction.editReply({ embeds: [embed] });
      } else {
        if (!targetMember.roles.cache.has(role.id)) {
          await interaction.editReply({
            embeds: [errorEmbed(`${targetUser.tag} does not have the ${role.name} role`)]
          });
          return;
        }
        await targetMember.roles.remove(role);
        const embed = successEmbed(`Removed ${role.name} from ${targetUser.tag}`);
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in role command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while modifying the role')]
      });
    }
  }
} as BotCommand;
