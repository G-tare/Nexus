import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { ensureGuild, ensureGuildMember } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('setreputation')
    .setDescription('Set a user\'s reputation to an exact value')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to set reputation for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('value')
        .setDescription('The exact reputation value to set (0-200)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.setreputation',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);
    const value = interaction.options.getInteger('value', true);

    try {
      const guild = interaction.guild!;
      await ensureGuild(guild);
      await ensureGuildMember(guildId, targetUser.id);

      // Get current reputation
      const memberData = await db
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUser.id)
          )
        )
        .limit(1);

      const oldReputation = memberData[0]?.reputation || 0;

      // Update reputation directly
      if (memberData.length > 0) {
        await db
          .update(guildMembers)
          .set({ reputation: value })
          .where(
            and(
              eq(guildMembers.guildId, guildId),
              eq(guildMembers.userId, targetUser.id)
            )
          );
      } else {
        // Create new entry if doesn't exist
        await db.insert(guildMembers).values({
          guildId,
          userId: targetUser.id,
          reputation: value,
        });
      }

      const embed = successEmbed(
        `Set reputation for ${targetUser.username}\n\n` +
        `**Old Score:** ${oldReputation}\n` +
        `**New Score:** ${value}`
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in setreputation command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while setting reputation')] });
    }
  },
} as BotCommand;
