import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  clearReactionLists,
  getReactionLists,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorreactionclear')
    .setDescription('Clear ALL reaction color messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorreactionclear',
  premiumFeature: 'colorroles.management',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const lists = await getReactionLists(guild.id);
    if (lists.length === 0) {
      await interaction.reply({ content: 'No reaction color messages to clear.' });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('colorreactionclear:confirm')
        .setLabel(`Yes, clear ${lists.length} reaction messages`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('colorreactionclear:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      content: `⚠️ This will delete **${lists.length}** reaction color messages. Continue?`,
      components: [row],
      fetchReply: true,
    });

    try {
      const btn = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 15_000,
      });

      if (btn.customId === 'colorreactionclear:confirm') {
        await btn.update({ content: '🗑️ Clearing...', components: [] });
        const count = await clearReactionLists(guild);
        await interaction.editReply({ content: `✅ Cleared **${count}** reaction color messages.`, components: [] });
      } else {
        await btn.update({ content: '❌ Cancelled.', components: [] });
      }
    } catch {
      await interaction.editReply({ content: '⏰ Timed out.', components: [] });
    }
  },
};

export default command;
