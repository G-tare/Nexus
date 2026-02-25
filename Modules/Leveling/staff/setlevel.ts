import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  User, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { totalXpForLevel, getLevelingConfig } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.setlevel',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Set a user\'s level directly')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to set the level for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('The level to set')
        .setMinValue(0)
        .setRequired(true)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user', true);
      const newLevel = interaction.options.getInteger('level', true);
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

      // Calculate total XP for target level
      const totalXp = totalXpForLevel(newLevel);

      // Update member
      await db.update(guildMembers)
        .set({
          level: newLevel,
          xp: 0,
          totalXp: totalXp,
        })
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUser.id)
          )
        );

      const embed = successEmbed(
        'Level Updated',
        `${targetUser.username} is now **Level ${newLevel}** with **${totalXp.toLocaleString()}** total XP.`
      )
        .setColor(Colors.Leveling)
        .setThumbnail(targetUser.avatarURL())
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[SetLevel Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while setting the level.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
