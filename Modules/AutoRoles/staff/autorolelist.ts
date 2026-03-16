import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutoRoleRules, CONDITION_LABELS } from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autorolelist')
    .setDescription('List all auto-role rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autorolelist',
  premiumFeature: 'autoroles.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const rules = await getAutoRoleRules(guild.id);

    if (rules.length === 0) {
      await interaction.reply({
        content: 'No auto-role rules configured. Use `/autoroleadd` to create one.',
      });
      return;
    }

    const lines = rules.map(rule => {
      const role = guild.roles.cache.get(rule.roleId);
      const roleName = role ? `<@&${role.id}>` : `\`${rule.roleId}\` (deleted)`;
      const status = rule.enabled ? '✅' : '❌';
      const delay = rule.delaySeconds > 0 ? ` (${rule.delaySeconds}s delay)` : '';
      const condVal = rule.conditionValue ? ` [${rule.conditionValue}]` : '';

      return `${status} \`#${rule.id}\` — ${roleName} • ${CONDITION_LABELS[rule.condition]}${condVal}${delay}`;
    });

    const container = moduleContainer('auto_roles');
    addText(container, `### 🏷️ Auto-Role Rules (${rules.length})`);
    addText(container, lines.join('\n'));
    addFooter(container, 'Use /autoroleadd to add • /autoroledelete to remove');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
