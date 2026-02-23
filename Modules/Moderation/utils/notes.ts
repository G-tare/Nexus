import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';

const NOTES_PER_PAGE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('View all staff notes for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view notes for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('The page number to display (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.notes',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);
    const page = interaction.options.getInteger('page') || 1;

    try {
      const allNotes = await db
        .select()
        .from(modCases)
        .where(
          and(
            eq(modCases.guildId, guildId),
            eq(modCases.targetId, targetUser.id),
            eq(modCases.action, 'note')
          )
        )
        .orderBy(desc(modCases.createdAt));

      if (!allNotes.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No notes found for ${targetUser.username}`)] });
      }

      const totalPages = Math.ceil(allNotes.length / NOTES_PER_PAGE);
      if (page > totalPages) {
        return interaction.editReply({ embeds: [errorEmbed(`Page ${page} does not exist. Max page: ${totalPages}`)] });
      }

      const startIdx = (page - 1) * NOTES_PER_PAGE;
      const pageNotes = allNotes.slice(startIdx, startIdx + NOTES_PER_PAGE);

      let description = '';
      for (const note of pageNotes) {
        const date = discordTimestamp(new Date(note.createdAt), 'f');
        description += `**#${note.caseNumber}** | <@${note.moderatorId}> | ${date}\n` +
          `${note.reason}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle(`Staff Notes - ${targetUser.username}`)
        .setDescription(description)
        .setFooter({ text: `Page ${page}/${totalPages} • Total notes: ${allNotes.length}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in notes command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while retrieving notes')] });
    }
  },
} as BotCommand;
