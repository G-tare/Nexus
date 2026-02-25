import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('ScheduledMessages');
import { formatNextFireTime, getNextFireTime } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('schedulelist')
    .setDescription('List all scheduled messages in this guild')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('filter')
        .setDescription('Filter by status: all, active, inactive')
        .setRequired(false)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Active Only', value: 'active' },
          { name: 'Inactive Only', value: 'inactive' }
        )
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.schedulelist',
  defaultPermissions: PermissionFlagsBits.ManageGuild,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const filter = interaction.options.getString('filter') ?? 'all';
      const db = (interaction.client as any).db;

      if (!db) {
        return await interaction.editReply('❌ Database not available.');
      }

      // Fetch scheduled messages
      let query = 'SELECT * FROM scheduledMessages WHERE guildId = $1';
      const params: any[] = [guildId];

      if (filter === 'active') {
        query += ' AND isActive = true';
      } else if (filter === 'inactive') {
        query += ' AND isActive = false';
      }

      query += ' ORDER BY createdAt DESC LIMIT 25';

      const result = await db.query(query, params);
      const messages = result.rows || [];

      if (messages.length === 0) {
        return await interaction.editReply(`No scheduled messages found (filter: ${filter})`);
      }

      // Create embed with list
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Scheduled Messages (${filter})`)
        .setDescription(`Showing ${messages.length} message(s)`);

      let fieldIndex = 0;
      for (const msg of messages.slice(0, 24)) {
        const status = msg.isActive ? '✅' : '⏸️';
        const type = msg.isRecurring ? '🔄' : '📅';

        let schedule = '';
        if (msg.isRecurring && msg.cronExpression) {
          schedule = msg.cronExpression;
        } else if (msg.scheduledFor) {
          const ts = Math.floor(new Date(msg.scheduledFor).getTime() / 1000);
          schedule = `<t:${ts}:R>`;
        }

        const channelMention = `<#${msg.channelId}>`;
        const contentPreview = msg.content
          ? msg.content.substring(0, 60) + (msg.content.length > 60 ? '...' : '')
          : '(Embed)';

        embed.addFields({
          name: `${status} ${type} ${msg.id}`,
          value: `Channel: ${channelMention}\nSchedule: ${schedule}\nContent: ${contentPreview}`,
          inline: false,
        });

        fieldIndex++;
        if (fieldIndex >= 24) break;
      }

      embed.setFooter({
        text: `Use /scheduleedit <id> to edit, /scheduledelete <id> to remove. Showing ${Math.min(messages.length, 24)} of ${messages.length}`,
      });

      // Create action row with buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('sm_refresh_list')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('sm_page_prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sm_page_next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [row] });

      logger.info(`[ScheduledMessages] Listed messages for guild ${guildId} (filter: ${filter})`);
    } catch (error) {
      logger.error('[ScheduledMessages] Error in schedulelist command:', error);
      await interaction.editReply({ content: '❌ An error occurred while listing scheduled messages.' });
    }
  },
};

export default command;
