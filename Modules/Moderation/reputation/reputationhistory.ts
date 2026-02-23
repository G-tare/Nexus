import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers, modCases } from '../../../Shared/src/database/models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';

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
      // Get reputation data
      const memberData = await db
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq((guildMembers as any).memberId, targetUser.id)
          )
        )
        .limit(1);

      const currentReputation = memberData[0]?.reputation || 0;
      const maxReputation = 100;

      // Create visual bar
      const filledBars = Math.floor((currentReputation / maxReputation) * 10);
      const emptyBars = 10 - filledBars;
      const reputationBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      // Get recent mod cases affecting reputation
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
        .limit(10);

      const embed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle(`Reputation History - ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: 'Current Score',
            value: `**${currentReputation}/${maxReputation}**`,
            inline: true,
          },
          {
            name: 'Progress',
            value: `\`${reputationBar}\` ${currentReputation}/${maxReputation}`,
            inline: false,
          }
        );

      // Add recent mod actions if any
      if (recentCases.length > 0) {
        let recentActionsText = '';
        for (const modCase of recentCases.slice(0, 5)) {
          const date = discordTimestamp(new Date(modCase.createdAt), 'f');
          recentActionsText += `**#${modCase.caseNumber}** ${modCase.action.toUpperCase()} | ${date}\n`;
        }

        embed.addFields({
          name: 'Recent Mod Actions',
          value: recentActionsText || 'None',
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
