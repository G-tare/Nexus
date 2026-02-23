import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutoRoleRules, CONDITION_LABELS } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autorolelist')
    .setDescription('List all auto-role rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

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
        ephemeral: true,
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

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`🏷️ Auto-Role Rules (${rules.length})`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Use /autoroleadd to add • /autoroledelete to remove' });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
