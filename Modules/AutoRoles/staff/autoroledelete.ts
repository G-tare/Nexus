import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { deleteAutoRoleRule, getAutoRoleRule } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoroledelete')
    .setDescription('Delete an auto-role rule')
    .addIntegerOption(opt =>
      opt.setName('rule_id')
        .setDescription('The rule ID to delete (from /autorolelist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autoroledelete',
  premiumFeature: 'autoroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const ruleId = interaction.options.getInteger('rule_id', true);

    const rule = await getAutoRoleRule(guild.id, ruleId);
    if (!rule) {
      await interaction.reply({ content: `❌ Rule with ID \`${ruleId}\` not found.`, ephemeral: true });
      return;
    }

    await deleteAutoRoleRule(guild.id, ruleId);

    const role = guild.roles.cache.get(rule.roleId);
    await interaction.reply({
      content: `✅ Deleted auto-role rule \`${ruleId}\` (role: ${role?.name || 'Deleted Role'}).`,
    });
  },
};

export default command;
