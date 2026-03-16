import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  addAutoRoleRule,
  getAutoRoleRules,
  AutoRoleCondition,
  CONDITION_LABELS,
} from '../helpers';
import { moduleContainer, addText, addField, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoroleadd')
    .setDescription('Add an auto-role rule')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The role to auto-assign')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('condition')
        .setDescription('When to assign the role')
        .addChoices(
          { name: 'Always (no condition)', value: 'none' },
          { name: 'Humans only', value: 'human' },
          { name: 'Bots only', value: 'bot' },
          { name: 'Has custom avatar', value: 'has_avatar' },
          { name: 'Account age > 1 day', value: 'account_age_1d' },
          { name: 'Account age > 7 days', value: 'account_age_7d' },
          { name: 'Account age > 30 days', value: 'account_age_30d' },
          { name: 'Account age > 90 days', value: 'account_age_90d' },
          { name: 'Server booster', value: 'boost' },
          { name: 'Joined via invite code', value: 'invite_code' },
        ))
    .addIntegerOption(opt =>
      opt.setName('delay')
        .setDescription('Delay in seconds before assigning (0 = immediate)')
        .setMinValue(0)
        .setMaxValue(86400))
    .addStringOption(opt =>
      opt.setName('invite_code')
        .setDescription('Invite code (only used with "Joined via invite code" condition)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autoroleadd',
  premiumFeature: 'autoroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const role = interaction.options.getRole('role', true);
    const condition = (interaction.options.getString('condition') || 'none') as AutoRoleCondition;
    const delay = interaction.options.getInteger('delay') || 0;
    const inviteCode = interaction.options.getString('invite_code') || null;

    // Check role hierarchy
    const botMember = guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: `❌ I can't assign **${role.name}** — it's higher than or equal to my highest role.`,
      });
      return;
    }

    // Can't auto-assign @everyone or managed roles
    if (role.id === guild.id) {
      await interaction.reply({ content: '❌ Can\'t auto-assign @everyone.' });
      return;
    }
    if (role.managed) {
      await interaction.reply({ content: '❌ Can\'t auto-assign managed (integration) roles.' });
      return;
    }

    // invite_code condition needs a value
    if (condition === 'invite_code' && !inviteCode) {
      await interaction.reply({
        content: '❌ The "Joined via invite code" condition requires the `invite_code` option.',
      });
      return;
    }

    // Check max rules (25)
    const existing = await getAutoRoleRules(guild.id);
    if (existing.length >= 25) {
      await interaction.reply({ content: '❌ Maximum 25 auto-role rules per server.' });
      return;
    }

    const conditionValue = condition === 'invite_code' ? inviteCode : null;
    const rule = await addAutoRoleRule(guild.id, role.id, condition, conditionValue, delay, interaction.user.id);

    const container = moduleContainer('auto_roles');
    addText(container, '### ✅ Auto-Role Rule Added');
    addSeparator(container, 'small');
    addField(container, 'Rule ID', `\`${rule.id}\``, true);
    addField(container, 'Role', `${role}`, true);
    addField(container, 'Condition', CONDITION_LABELS[condition], true);
    addField(container, 'Delay', delay > 0 ? `${delay}s` : 'Immediate', true);

    if (conditionValue) {
      addField(container, 'Invite Code', `\`${conditionValue}\``, true);
    }

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
