import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';
import { getUserRep, getRepHistory, formatDelta, relativeTimestamp } from '../../Reputation/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('reputationhistory')
    .setDescription('View reputation information and recent mod actions for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view reputation for')
        .setRequired(true)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.reputationhistory',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);

    try {
      // Get reputation from the dedicated reputation_users table
      const currentReputation = await getUserRep(guildId, targetUser.id);

      // Create visual bar (scale based on reputation value)
      const maxBar = 100;
      const clamped = Math.min(Math.max(currentReputation, 0), maxBar);
      const filledBars = Math.floor((clamped / maxBar) * 10);
      const emptyBars = 10 - filledBars;
      const reputationBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      // Get rep change history from the dedicated reputation_history table
      const repHistory = await getRepHistory(guildId, targetUser.id, 5);

      // Get recent mod cases
      const recentCases = await db
        .select()
        .from(modCases)
        .where(
          and(
            eq(modCases.guildId, guildId),
            eq(modCases.targetId, targetUser.id)
          )
        )
        .orderBy(desc(modCases.createdAt))
        .limit(5);

      const embed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle(`Reputation History — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: 'Current Reputation',
            value: `**${currentReputation}**`,
            inline: true,
          },
          {
            name: 'Progress',
            value: `\`${reputationBar}\` ${clamped}/${maxBar}`,
            inline: false,
          }
        );

      // Add rep change history if any
      if (repHistory.length > 0) {
        let historyText = '';
        for (const entry of repHistory) {
          const time = relativeTimestamp(entry.createdAt);
          historyText += `${formatDelta(entry.delta)} by <@${entry.givenBy}> ${time}`;
          if (entry.reason) historyText += ` — ${entry.reason}`;
          historyText += '\n';
        }
        embed.addFields({
          name: 'Recent Rep Changes',
          value: historyText.trim(),
          inline: false,
        });
      }

      // Add recent mod actions if any
      if (recentCases.length > 0) {
        let recentActionsText = '';
        for (const modCase of recentCases) {
          const date = discordTimestamp(new Date(modCase.createdAt), 'f');
          recentActionsText += `**#${modCase.caseNumber}** ${modCase.action.toUpperCase()} | ${date}\n`;
        }

        embed.addFields({
          name: 'Recent Mod Actions',
          value: recentActionsText.trim() || 'None',
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in reputationhistory command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while retrieving reputation history')] });
    }
  },
} as BotCommand;
