import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRepRoles, addRepRole, removeRepRole } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('reproles')
    .setDescription('Manage reputation-gated roles')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all rep-gated roles'))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a rep-gated role')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role to gate')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('required_rep')
            .setDescription('Minimum reputation to earn this role')
            .setRequired(true))
        .addBooleanOption(opt =>
          opt.setName('remove_on_drop')
            .setDescription('Remove role if rep drops below threshold (default: true)')))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a rep-gated role')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('The role to ungate')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.reproles',
  premiumFeature: 'reputation.roles',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const roles = await getRepRoles(guild.id);

      if (roles.length === 0) {
        await interaction.reply({ content: 'No rep-gated roles configured. Use `/reproles add` to create one.', ephemeral: true });
        return;
      }

      const lines = roles.map(rr => {
        const role = guild.roles.cache.get(rr.roleId);
        const roleName = role ? `<@&${role.id}>` : `\`${rr.roleId}\` (deleted)`;
        const drop = rr.removeOnDrop ? '(removes on drop)' : '(keeps on drop)';
        return `• ${roleName} — requires **${rr.requiredRep}** rep ${drop}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle(`⭐ Rep-Gated Roles (${roles.length})`)
        .setDescription(lines.join('\n'));

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);
      const requiredRep = interaction.options.getInteger('required_rep', true);
      const removeOnDrop = interaction.options.getBoolean('remove_on_drop') ?? true;

      if (role.managed || role.id === guild.id) {
        await interaction.reply({ content: '❌ Can\'t gate managed roles or @everyone.', ephemeral: true });
        return;
      }

      // Max 20 rep roles
      const existing = await getRepRoles(guild.id);
      if (existing.length >= 20) {
        await interaction.reply({ content: '❌ Maximum 20 rep-gated roles.', ephemeral: true });
        return;
      }

      await addRepRole(guild.id, role.id, requiredRep, removeOnDrop);

      await interaction.reply({
        content: `✅ **${role.name}** now requires **${requiredRep}** rep.${removeOnDrop ? ' Role will be removed if rep drops below.' : ''}`,
      });
      return;
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true);
      const removed = await removeRepRole(guild.id, role.id);

      if (!removed) {
        await interaction.reply({ content: `**${role.name}** is not a rep-gated role.`, ephemeral: true });
        return;
      }

      await interaction.reply({ content: `✅ Removed rep gate from **${role.name}**.` });
      return;
    }
  },
};

export default command;
