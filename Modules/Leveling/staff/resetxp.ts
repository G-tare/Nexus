import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.resetxp',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('resetxp')
    .setDescription('Reset a user\'s XP and level to 0')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to reset')
        .setRequired(true)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user', true);
      const guildId = interaction.guildId!;

      const db = getDb();

      // Ensure member exists
      await db.execute(sql`
        INSERT INTO users (id, created_at, updated_at) VALUES (${targetUser.id}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
      await db.execute(sql`
        INSERT INTO guild_members (guild_id, user_id) VALUES (${guildId}, ${targetUser.id})
        ON CONFLICT (guild_id, user_id) DO NOTHING
      `);

      // Reset XP and level
      await db.update(guildMembers)
        .set({
          xp: 0,
          level: 0,
          totalXp: 0,
        })
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUser.id)
          )
        );

      const embed = successEmbed(
        'XP Reset',
        `${targetUser.username}'s XP and level have been reset to 0.`
      )
        .setColor(Colors.Leveling)
        .setThumbnail(targetUser.avatarURL())
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[ResetXP Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while resetting the XP.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
