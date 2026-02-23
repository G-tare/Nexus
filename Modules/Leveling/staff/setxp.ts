import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { levelFromTotalXp } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.setxp',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Set a user\'s total XP directly')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to set XP for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('xp')
        .setDescription('The total XP to set')
        .setMinValue(0)
        .setRequired(true)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user', true);
      const totalXp = interaction.options.getInteger('xp', true);
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

      // Calculate level from total XP
      const levelInfo = levelFromTotalXp(totalXp);

      // Update member
      await db.update(guildMembers)
        .set({
          totalXp: totalXp,
          level: levelInfo.level,
          xp: levelInfo.currentXp,
        })
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUser.id)
          )
        );

      const embed = successEmbed(
        'XP Updated',
        `${targetUser.username} now has **${totalXp.toLocaleString()}** total XP (Level ${levelInfo.level}).`
      )
        .setColor(Colors.Leveling)
        .setThumbnail(targetUser.avatarURL())
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[SetXP Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while setting the XP.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
