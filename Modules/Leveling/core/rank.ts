import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getLevelingConfig, levelFromTotalXp, getRankPosition, rankEmbed } from '../helpers';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.rank',
  premiumFeature: 'leveling.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your rank card or another user\'s rank card')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view the rank of (defaults to yourself)')
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: false });

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId!;

      if (!guildId) {
        return interaction.editReply({
          embeds: [
            errorEmbed('Error', 'This command can only be used in a server.')
              .setColor(Colors.Error)
          ]
        });
      }

      const db = getDb();

      // Get member data
      const memberData = await db
        .select({
          xp: guildMembers.xp,
          level: guildMembers.level,
          totalXp: guildMembers.totalXp,
          prestige: guildMembers.prestige,
        })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, targetUser.id)
        ))
        .limit(1);

      if (!memberData || memberData.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Warning)
              .setTitle(`${targetUser.username}'s Rank`)
              .setDescription(`${targetUser.username} hasn't earned any XP yet.`)
              .setThumbnail(targetUser.displayAvatarURL())
              .setTimestamp()
          ]
        });
      }

      const member = memberData[0];
      const totalXp = Number(member.totalXp) || 0;
      const prestige = member.prestige || 0;

      // Calculate level progression
      const levelInfo = levelFromTotalXp(totalXp);

      // Get rank position
      const rankPosition = await getRankPosition(guildId, targetUser.id);

      // Build rank embed
      const embed = rankEmbed({
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL(),
        level: levelInfo.level,
        currentXp: levelInfo.currentXp,
        xpNeeded: levelInfo.xpNeeded,
        totalXp,
        rank: rankPosition,
        prestige,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Rank Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while fetching rank data.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
