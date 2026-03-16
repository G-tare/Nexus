import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import { moduleContainer, addText, addFooter, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('scheduledelete')
    .setDescription('Delete a scheduled message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('ID of the scheduled message to delete')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.scheduledelete',
  defaultPermissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const id = interaction.options.getString('id', true);
      const guildId = interaction.guildId!;
      const db = (interaction.client as any).db;

      if (!db) {
        return await interaction.editReply('❌ Database not available.');
      }

      // Fetch the scheduled message
      const result = await db.query(
        'SELECT * FROM scheduledMessages WHERE id = $1 AND guildId = $2',
        [id, guildId]
      );

      if (!result.rows || result.rows.length === 0) {
        return await interaction.editReply('❌ Scheduled message not found.');
      }

      const message = result.rows[0];

      // Create confirmation container
      const container = moduleContainer('scheduled_messages');
      container.setAccentColor(0xff6600);
      addText(container, '### Delete Scheduled Message?');
      addText(container, `**Message ID**\n\`${message.id}\``);
      addText(container, `**Channel**\n<#${message.channelId}>`);
      addText(container, `**Type**\n${message.isRecurring ? 'Recurring' : 'One-time'}`);
      addText(container, `**Status**\n${message.isActive ? 'Active' : 'Inactive'}`);
      addText(container, `**Content**\n${message.content || '(Embed)'}`);
      addFooter(container, 'This action cannot be undone');

      // Create confirmation buttons
      const buttons = [
        new ButtonBuilder()
          .setCustomId(`sm_confirm_delete_${id}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('sm_cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      ];
      addButtons(container, buttons);

      await interaction.editReply(v2Payload([container]));

      // Create collector for button interaction
      const filter = (i: any) => {
        return (i.customId === `sm_confirm_delete_${id}` || i.customId === 'sm_cancel_delete') &&
               i.user.id === interaction.user.id;
      };

      const collector = interaction.channel?.createMessageComponentCollector({
        filter,
        time: 30000,
      });

      if (collector) {
        collector.on('collect', async (i) => {
          if (i.customId === `sm_confirm_delete_${id}`) {
            // Delete the message
            await db.query('DELETE FROM scheduledMessages WHERE id = $1 AND guildId = $2', [id, guildId]);

            const successContainer = moduleContainer('scheduled_messages');
            successContainer.setAccentColor(0x00aa00);
            addText(successContainer, '### Scheduled Message Deleted');
            addText(successContainer, `**Message ID**\n\`${id}\``);

            await i.update(v2Payload([successContainer]));
            logger.info(`[ScheduledMessages] Deleted scheduled message ${id} from guild ${guildId}`);
          } else if (i.customId === 'sm_cancel_delete') {
            const cancelContainer = moduleContainer('scheduled_messages');
            cancelContainer.setAccentColor(0x0099ff);
            addText(cancelContainer, '### Deletion Cancelled\nThe scheduled message was not deleted.');

            await i.update(v2Payload([cancelContainer]));
          }

          collector.stop();
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            // No interaction received, update with timeout message
            await interaction.editReply({
              content: '❌ Confirmation timed out. Scheduled message was not deleted.',
              components: [],
            });
          }
        });
      }
    } catch (error) {
      logger.error('[ScheduledMessages] Error in scheduledelete command:', error);
      await interaction.editReply({ content: '❌ An error occurred while deleting the scheduled message.' });
    }
  },
};

export default command;
