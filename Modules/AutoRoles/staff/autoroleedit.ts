import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getAutoRoleRule,
  updateAutoRoleRule,
  AutoRoleCondition,
  CONDITION_LABELS,
} from '../helpers';
import { moduleContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoroleedit')
    .setDescription('Edit an existing auto-role rule')
    .addIntegerOption(opt =>
      opt.setName('rule_id')
        .setDescription('The rule ID to edit')
        .setRequired(true))
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('New role to assign'))
    .addStringOption(opt =>
      opt.setName('condition')
        .setDescription('New condition')
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
        .setDescription('New delay in seconds')
        .setMinValue(0)
        .setMaxValue(86400))
    .addBooleanOption(opt =>
      opt.setName('enabled')
        .setDescription('Enable or disable the rule'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autoroleedit',
  premiumFeature: 'autoroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const ruleId = interaction.options.getInteger('rule_id', true);

    const rule = await getAutoRoleRule(guild.id, ruleId);
    if (!rule) {
      await interaction.reply({ content: `❌ Rule \`${ruleId}\` not found.` });
      return;
    }

    const role = interaction.options.getRole('role');
    const condition = interaction.options.getString('condition') as AutoRoleCondition | null;
    const delay = interaction.options.getInteger('delay');
    const enabled = interaction.options.getBoolean('enabled');

    const updates: any = {};
    const changes: string[] = [];

    if (role) {
      updates.roleId = role.id;
      changes.push(`Role → ${role}`);
    }
    if (condition) {
      updates.condition = condition;
      changes.push(`Condition → ${CONDITION_LABELS[condition]}`);
    }
    if (delay !== null) {
      updates.delaySeconds = delay;
      changes.push(`Delay → ${delay > 0 ? `${delay}s` : 'Immediate'}`);
    }
    if (enabled !== null) {
      updates.enabled = enabled;
      changes.push(`Status → ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    if (changes.length === 0) {
      await interaction.reply({ content: '❌ No changes specified.' });
      return;
    }

    await updateAutoRoleRule(guild.id, ruleId, updates);

    const container = moduleContainer('auto_roles');
    addText(container, `### ✏️ Rule #${ruleId} Updated`);
    addSeparator(container, 'small');
    addText(container, changes.join('\n'));

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
