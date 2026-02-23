import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');

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
      await interaction.deferReply({ ephemeral: true });

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

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('Delete Scheduled Message?')
        .addFields(
          { name: 'Message ID', value: `\`${message.id}\``, inline: true },
          { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
          { name: 'Type', value: message.isRecurring ? 'Recurring' : 'One-time', inline: true },
          { name: 'Status', value: message.isActive ? 'Active' : 'Inactive', inline: true },
          { name: 'Content', value: message.content || '(Embed)', inline: false }
        )
        .setFooter({ text: 'This action cannot be undone' });

      // Create confirmation buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`sm_confirm_delete_${id}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('sm_cancel_delete')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

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

            const successEmbed = new EmbedBuilder()
              .setColor('#00aa00')
              .setTitle('Scheduled Message Deleted')
              .addFields(
                { name: 'Message ID', value: `\`${id}\``, inline: true }
              );

            await i.update({ embeds: [successEmbed], components: [] });
            logger.info(`[ScheduledMessages] Deleted scheduled message ${id} from guild ${guildId}`);
          } else if (i.customId === 'sm_cancel_delete') {
            const cancelEmbed = new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('Deletion Cancelled')
              .setDescription('The scheduled message was not deleted.');

            await i.update({ embeds: [cancelEmbed], components: [] });
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
