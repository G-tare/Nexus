import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, moduleContainer, addText, addFooter } from '../../../Shared/src/utils/componentsV2';
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
    await interaction.deferReply({});

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ components: [errorContainer('Guild context required')], flags: MessageFlags.IsComponentsV2 });

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
        return interaction.editReply({ components: [errorContainer(`No notes found for ${targetUser.username}`)], flags: MessageFlags.IsComponentsV2 });
      }

      const totalPages = Math.ceil(allNotes.length / NOTES_PER_PAGE);
      if (page > totalPages) {
        return interaction.editReply({ components: [errorContainer(`Page ${page} does not exist`, `Max page: ${totalPages}`)], flags: MessageFlags.IsComponentsV2 });
      }

      const startIdx = (page - 1) * NOTES_PER_PAGE;
      const pageNotes = allNotes.slice(startIdx, startIdx + NOTES_PER_PAGE);

      let description = '';
      for (const note of pageNotes) {
        const date = discordTimestamp(new Date(note.createdAt), 'f');
        description += `**#${note.caseNumber}** | <@${note.moderatorId}> | ${date}\n` +
          `${note.reason}\n\n`;
      }

      const container = moduleContainer('moderation');
      addText(container, `### Staff Notes - ${targetUser.username}\n${description}`);
      addFooter(container, `Page ${page}/${totalPages} • Total notes: ${allNotes.length}`);

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error in notes command:', error);
      return interaction.editReply({ components: [errorContainer('An error occurred while retrieving notes')], flags: MessageFlags.IsComponentsV2 });
    }
  },
} as BotCommand;
