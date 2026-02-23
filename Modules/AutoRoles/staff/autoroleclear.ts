import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { clearAutoRoleRules, getAutoRoleRules } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoroleclear')
    .setDescription('Remove all auto-role rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'autoroles',
  permissionPath: 'autoroles.autoroleclear',
  premiumFeature: 'autoroles.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const rules = await getAutoRoleRules(guild.id);

    if (rules.length === 0) {
      await interaction.reply({ content: 'No auto-role rules to clear.', ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('autoroleclear:confirm')
        .setLabel(`Yes, delete all ${rules.length} rules`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('autoroleclear:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      content: `⚠️ Are you sure you want to delete all **${rules.length}** auto-role rules?`,
      components: [row],
      fetchReply: true,
    });

    try {
      const btn = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 15_000,
      });

      if (btn.customId === 'autoroleclear:confirm') {
        const count = await clearAutoRoleRules(guild.id);
        await btn.update({ content: `✅ Deleted **${count}** auto-role rules.`, components: [] });
      } else {
        await btn.update({ content: '❌ Cancelled.', components: [] });
      }
    } catch {
      await interaction.editReply({ content: '⏰ Timed out.', components: [] });
    }
  },
};

export default command;
