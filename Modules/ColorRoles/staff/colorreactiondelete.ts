import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  deleteReactionList,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorreactiondelete')
    .setDescription('Delete a specific reaction color message')
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('The reaction list ID (from /colorreactionlist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorreactiondelete',
  premiumFeature: 'colorroles.management',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const listId = interaction.options.getInteger('id', true);

    const deleted = await deleteReactionList(guild, listId);
    if (!deleted) {
      await interaction.reply({
        content: `Reaction list with ID \`${listId}\` not found.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Reaction color message \`${listId}\` deleted.`,
      ephemeral: true,
    });
  },
};

export default command;
