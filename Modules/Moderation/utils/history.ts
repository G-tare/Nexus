import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, desc } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';

const CASES_PER_PAGE = 10;

const actionColors: Record<string, number> = {
  'ban': 0xFF0000,
  'kick': 0xFF6600,
  'mute': 0xFFAA00,
  'warn': 0xFFCC00,
  'note': 0x0099FF,
  'unban': 0x00CC00,
  'unmute': 0x00AA00,
};

const actionEmojis: Record<string, string> = {
  'ban': '🚫',
  'kick': '🚪',
  'mute': '🔇',
  'warn': '⚠️',
  'note': '📝',
  'unban': '✅',
  'unmute': '🔊',
};

export default {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View the full moderation history for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view history for')
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
  permissionPath: 'moderation.history',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);
    const page = interaction.options.getInteger('page') || 1;

    try {
      const allCases = await db
        .select()
        .from(modCases)
        .where(eq(modCases.targetId, targetUser.id))
        .orderBy(desc(modCases.createdAt));

      if (!allCases.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No moderation history found for ${targetUser.username}`)] });
      }

      const totalPages = Math.ceil(allCases.length / CASES_PER_PAGE);
      if (page > totalPages) {
        return interaction.editReply({ embeds: [errorEmbed(`Page ${page} does not exist. Max page: ${totalPages}`)] });
      }

      const startIdx = (page - 1) * CASES_PER_PAGE;
      const pageCases = allCases.slice(startIdx, startIdx + CASES_PER_PAGE);

      let description = '';
      for (const modCase of pageCases) {
        const emoji = actionEmojis[modCase.action] || '📋';
        const date = discordTimestamp(new Date(modCase.createdAt), 'f');
        description += `**#${modCase.caseNumber}** ${emoji} ${modCase.action.toUpperCase()}\n` +
          `Moderator: <@${modCase.moderatorId}> | ${date}\n` +
          `Reason: ${modCase.reason || 'No reason provided'}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Info)
        .setTitle(`Moderation History - ${targetUser.username}`)
        .setDescription(description)
        .setFooter({ text: `Page ${page}/${totalPages} • Total cases: ${allCases.length}` });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in history command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while retrieving history')] });
    }
  },
} as BotCommand;
