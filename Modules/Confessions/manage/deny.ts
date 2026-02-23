import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getPendingConfessionData,
  removePendingConfession,
} from '../helpers';


const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.confession-deny',
  data: new SlashCommandBuilder()
    .setName('confession-deny')
    .setDescription('Deny a pending confession')
    .addIntegerOption(opt =>
      opt
        .setName('id')
        .setDescription('Confession ID number')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for denial (optional)')
        .setRequired(false)
        .setMaxLength(500)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const confessionId = interaction.options.getInteger('id', true);
    const reason = interaction.options.getString('reason', false);

    // Check if pending confession exists
    const pendingData = await getPendingConfessionData(guildId, confessionId);
    if (!pendingData) {
      await interaction.reply({
        content: `Pending confession #${confessionId} not found.`,
        ephemeral: true,
      });
      return;
    }

    try {
      // Remove from pending
      await removePendingConfession(guildId, confessionId);

      const reasonText = reason ? ` (Reason: ${reason})` : '';
      await interaction.reply({
        content: `Confession #${confessionId} has been denied.${reasonText}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error denying confession:', error);
      await interaction.reply({
        content: 'Failed to deny confession.',
        ephemeral: true,
      });
    }
  },
};

export default command;
