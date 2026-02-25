import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getAutoRoleRules, CONDITION_LABELS } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('myroles')
    .setDescription('View your auto-assigned roles in this server') as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.myroles',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const member = await guild.members.fetch(interaction.user.id);

    const rules = await getAutoRoleRules(guild.id);
    const enabledRules = rules.filter(r => r.enabled);

    // Find which auto-role rules match the member's current roles
    const autoRoles: Array<{ roleName: string; condition: string }> = [];

    for (const rule of enabledRules) {
      if (member.roles.cache.has(rule.roleId)) {
        const role = guild.roles.cache.get(rule.roleId);
        if (role) {
          autoRoles.push({
            roleName: role.name,
            condition: CONDITION_LABELS[rule.condition],
          });
        }
      }
    }

    if (autoRoles.length === 0) {
      await interaction.reply({
        content: 'You don\'t have any auto-assigned roles in this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🏷️ Your Auto-Assigned Roles')
      .setDescription(
        autoRoles.map(r => `• **${r.roleName}** — ${r.condition}`).join('\n'),
      )
      .setFooter({ text: `${autoRoles.length} auto-role${autoRoles.length > 1 ? 's' : ''}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
