import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { discordTimestamp } from '../../../Shared/src/utils/time';
import { ensureGuild } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View and manage mod cases')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a specific mod case')
        .addIntegerOption(option =>
          option
            .setName('case_id')
            .setDescription('The case ID to view')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit the reason for a mod case')
        .addIntegerOption(option =>
          option
            .setName('case_id')
            .setDescription('The case ID to edit')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('new_reason')
            .setDescription('The new reason for this case')
            .setRequired(true)
            .setMaxLength(500)
        )
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.case',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const subcommand = interaction.options.getSubcommand();
    const caseId = interaction.options.getInteger('case_id', true);

    try {
      if (subcommand === 'view') {
        const modCase = await db
          .select()
          .from(modCases)
          .where(eq(modCases.id, caseId))
          .limit(1);

        if (!modCase.length) {
          return interaction.editReply({ embeds: [errorEmbed(`Case #${caseId} not found`)] });
        }

        const caseData = modCase[0];
        const actionTypes: Record<string, string> = {
          'warn': 'Warning',
          'mute': 'Mute',
          'kick': 'Kick',
          'ban': 'Ban',
          'note': 'Staff Note',
          'unban': 'Unban',
          'unmute': 'Unmute',
        };

        const embed = new EmbedBuilder()
          .setColor(Colors.Info)
          .setTitle(`Case #${caseData.caseNumber}`)
          .addFields(
            { name: 'Action', value: actionTypes[caseData.action] || caseData.action, inline: true },
            { name: 'Target User', value: `<@${caseData.targetId}>`, inline: true },
            { name: 'Moderator', value: `<@${caseData.moderatorId}>`, inline: true },
            { name: 'Reason', value: caseData.reason || 'No reason provided', inline: false }
          );

        if (caseData.duration) {
          embed.addFields({ name: 'Duration', value: String(caseData.duration), inline: true });
        }

        embed.addFields({ name: 'Created', value: discordTimestamp(new Date(caseData.createdAt), 'F'), inline: true });

        if (caseData.isActive === false) {
          embed.addFields({ name: 'Status', value: 'Inactive', inline: true });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'edit') {
        const newReason = interaction.options.getString('new_reason', true);

        const modCase = await db
          .select()
          .from(modCases)
          .where(eq(modCases.id, caseId))
          .limit(1);

        if (!modCase.length) {
          return interaction.editReply({ embeds: [errorEmbed(`Case #${caseId} not found`)] });
        }

        const caseData = modCase[0];

        // Only allow editing if the current user is a moderator or the original moderator
        if (interaction.user.id !== caseData.moderatorId) {
          const guild = interaction.guild!;
          await ensureGuild(guild);
          const member = await guild.members.fetch(interaction.user.id).catch(() => null);
          if (!member?.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ embeds: [errorEmbed('You can only edit cases you created, or you need Administrator permissions')] });
          }
        }

        await db
          .update(modCases)
          .set({ reason: newReason })
          .where(eq(modCases.id, caseId));

        return interaction.editReply({ embeds: [successEmbed(`Case #${caseData.caseNumber} reason updated`)] });
      }
    } catch (error) {
      console.error('Error in case command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while processing your request')] });
    }
  },
} as BotCommand;
