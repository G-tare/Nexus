import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { errorReply, v2Payload } from '../../../Shared/src/utils/componentsV2';
import {
  levelFromTotalXp,
  getRankPosition,
  rankContainer,
  generateRankCard,
  getUserCardStyle,
  getUserCardBg,
} from '../helpers';

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
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId!;

      if (!guildId) {
        return interaction.editReply(errorReply('Error', 'This command can only be used in a server.'));
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
        return interaction.editReply(errorReply(`${targetUser.username}'s Rank`, `${targetUser.username} hasn't earned any XP yet.`));
      }

      const member = memberData[0];
      const totalXp = Number(member.totalXp) || 0;
      const prestige = member.prestige || 0;

      // Calculate level progression
      const levelInfo = levelFromTotalXp(totalXp);

      // Get rank position
      const rankPosition = await getRankPosition(guildId, targetUser.id);

      // Get user card preferences from Redis
      const cardStyle = await getUserCardStyle(guildId, targetUser.id);
      const customBg = await getUserCardBg(guildId, targetUser.id);

      // Try to generate canvas-based rank card image
      const cardImage = await generateRankCard({
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL({ size: 256 }),
        level: levelInfo.level,
        currentXp: levelInfo.currentXp,
        xpNeeded: levelInfo.xpNeeded,
        totalXp,
        rank: rankPosition,
        prestige,
        style: cardStyle,
        customBgUrl: customBg || undefined,
      });

      if (cardImage) {
        // Send the image-based card
        return interaction.editReply({ files: [cardImage] });
      }

      // Fall back to text container if canvas is unavailable
      const container = rankContainer({
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL(),
        level: levelInfo.level,
        currentXp: levelInfo.currentXp,
        xpNeeded: levelInfo.xpNeeded,
        totalXp,
        rank: rankPosition,
        prestige,
      });

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Rank Command Error]', error);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching rank data.'));
    }
  }
};

export default command;
