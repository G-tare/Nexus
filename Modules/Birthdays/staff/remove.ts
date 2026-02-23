import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { removeBirthday, getBirthday } from '../helpers';
import { eventBus } from '../../../Shared/src/events/eventBus';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.remove',
  premiumFeature: 'birthdays.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('birthdayremove')
    .setDescription("Remove a user's birthday (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User whose birthday to remove')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for removal')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const existing = await getBirthday(targetUser.id);
      if (!existing) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a birthday set.`,
        });
      }

      await removeBirthday(targetUser.id);

      eventBus.emit('auditLog', {
        guildId: interaction.guildId!,
        type: 'BIRTHDAY_REMOVED_BY_STAFF',
        data: {
          targetId: targetUser.id,
          moderatorId: interaction.user.id,
          reason,
        },
      });

      await interaction.editReply({
        content: `✅ Removed birthday for ${targetUser.username}.`,
      });
    } catch (error) {
      console.error('[Birthdays] /birthdayremove error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while removing the birthday.',
      });
    }
  },
};

export default command;
