import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, desc } from 'drizzle-orm';
import { ensureGuild, ensureGuildMember } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a private staff note to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to add a note for')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('The note text')
        .setRequired(true)
        .setMaxLength(500)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.note',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ components: [errorContainer('Guild context required')], flags: MessageFlags.IsComponentsV2 });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);
    const noteText = interaction.options.getString('text', true);

    try {
      const guild = interaction.guild!;
      await ensureGuild(guild);
      await ensureGuildMember(guildId, targetUser.id);

      // Get the next case number
      const lastCase = await db
        .select()
        .from(modCases)
        .where(eq(modCases.guildId, guildId))
        .orderBy(desc(modCases.caseNumber))
        .limit(1);

      const nextCaseNumber = (lastCase[0]?.caseNumber || 0) + 1;

      // Create the note case
      await db.insert(modCases).values({
        guildId,
        caseNumber: nextCaseNumber,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: noteText,
        isActive: true,
        createdAt: new Date(),
      });

      return interaction.editReply({ components: [successContainer(`Note added for ${targetUser.username}`)], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error in note command:', error);
      return interaction.editReply({ components: [errorContainer('An error occurred while adding the note')], flags: MessageFlags.IsComponentsV2 });
    }
  },
} as BotCommand;
