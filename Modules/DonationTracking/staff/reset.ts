import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionCollector,
  ButtonInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, addButtons, v2Payload, warningReply, successReply, infoReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import { resetGuildDonations } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('DonationTracking:Reset');

const command: BotCommand = {
  module: 'donationtracking',
  permissionPath: 'donationtracking.staff.reset',
  premiumFeature: 'donationtracking.advanced',
  data: new SlashCommandBuilder()
    .setName('donationreset')
    .setDescription('Reset all donation data for this guild')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('reset_confirm')
        .setLabel('Yes, reset all data')
        .setStyle(ButtonStyle.Danger);

      const cancelButton = new ButtonBuilder()
        .setCustomId('reset_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const container = moduleContainer('donation_tracking');
      addText(container, '### Reset All Donation Data\nThis action **cannot be undone**. All donation records will be permanently deleted.');
      addFooter(container, 'You have 30 seconds to confirm.');
      addButtons(container, [confirmButton, cancelButton]);

      await interaction.editReply(v2Payload([container]));

      // Create collector
      const collector = new InteractionCollector(interaction.client, {
        filter: (i: any) => {
          return (
            i.isButton() &&
            (i.customId === 'reset_confirm' || i.customId === 'reset_cancel') &&
            i.user.id === interaction.user.id
          );
        },
        time: 30000,
        max: 1,
      });

      collector.on('collect', async (collected: any) => {
        const button = collected as ButtonInteraction;

        if (button.customId === 'reset_cancel') {
          await button.deferUpdate();
          return interaction.editReply({
            ...infoReply('Reset Cancelled', 'No data was deleted.'),
            components: [],
          });
        }

        if (button.customId === 'reset_confirm') {
          await button.deferUpdate();

          try {
            const deletedCount = await resetGuildDonations(guildId);

            return interaction.editReply({
              ...successReply('Data Reset Complete', `Deleted **${deletedCount}** donation record(s).`),
              components: [],
            });
          } catch (error) {
            logger.error(`Error resetting donations: ${error}`);
            return interaction.editReply({
              ...errorReply('Reset Failed', 'An error occurred while resetting the data.'),
              components: [],
            });
          }
        }
      });

      collector.on('end', async (collected: any) => {
        if (collected.size === 0) {
          return interaction.editReply({
            ...infoReply('Reset Timed Out', 'The confirmation prompt expired.'),
            components: [],
          });
        }
      });
    } catch (error) {
      logger.error(`Error in reset command: ${error}`);
      return interaction.editReply(errorReply('Error', 'An error occurred.'));
    }
  },
};

export default command;
