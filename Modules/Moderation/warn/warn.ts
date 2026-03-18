import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase, sendModDM, canModerate, buildModActionContainer,
  getModConfig, ensureGuild, ensureGuildMember, adjustReputation,
  checkWarnThresholds, deductFine,
} from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the warning').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.warn',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const guild = interaction.guild!;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: 'User not found in this server.' });
      return;
    }

    const check = canModerate(interaction.member as any, targetMember, 'warn');
    if (check) {
      await interaction.reply({ content: check });
      return;
    }

    await interaction.deferReply();

    const config = await getModConfig(guild.id);

    // Enforce requireReason
    if (config.requireReason && !rawReason) {
      await interaction.editReply({ content: '❌ This server requires a reason for moderation actions. Please provide a reason.' });
      return;
    }

    await ensureGuild(guild);
    await ensureGuildMember(guild.id, target.id);

    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'warn',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });

    // Increment warn count
    const db = getDb();
    await db.execute(sql`
      UPDATE guild_members SET warn_count = warn_count + 1
      WHERE guild_id = ${guild.id} AND user_id = ${target.id}
    `);

    // Get updated warn count
    const [member] = await db.select({ warnCount: guildMembers.warnCount })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, target.id)))
      .limit(1);

    const warnCount = member?.warnCount || 1;

    // DM user
    let dmSent = false;
    if (config.dmOnWarn) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Warning',
        reason,
        caseNumber,
        appealEnabled: config.appealEnabled,
      });
    }

    // Reputation penalty
    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.warn, 'Warning', interaction.user.id);
    }

    // Currency fine
    const fineDeducted = await deductFine(guild.id, target.id, 'warn', config);

    // Check thresholds for auto-escalation
    const escalation = await checkWarnThresholds(guild.id, target.id, warnCount, config, guild);

    // Build extra fields for the response embed
    const extraFields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Total Warnings', value: `${warnCount}`, inline: true },
    ];
    if (fineDeducted > 0) {
      extraFields.push({ name: 'Fine', value: `-${fineDeducted} coins`, inline: true });
    }

    if (escalation) {
      const actionLabel = escalation.action === 'mute' ? 'Muted'
        : escalation.action === 'kick' ? 'Kicked' : 'Banned';
      let escalationText = `⚡ Auto-${actionLabel} — reached ${escalation.threshold} warnings`;
      if (escalation.action === 'mute' && escalation.duration) {
        const hours = Math.floor(escalation.duration / 3600);
        const mins = Math.floor((escalation.duration % 3600) / 60);
        const durationStr = hours > 0
          ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
          : `${mins}m`;
        escalationText += ` (${durationStr})`;
      }
      extraFields.push({ name: 'Auto-Escalation', value: escalationText });

      // Send auto-escalation DM to the user
      const dmAction = escalation.action === 'mute' ? 'Auto-Mute'
        : escalation.action === 'kick' ? 'Auto-Kick' : 'Auto-Ban';
      const dmDuration = escalation.action === 'mute' && escalation.duration
        ? (() => {
            const h = Math.floor(escalation.duration! / 3600);
            const m = Math.floor((escalation.duration! % 3600) / 60);
            return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
          })()
        : undefined;
      await sendModDM({
        user: target,
        guild,
        action: `${dmAction} (${warnCount} warnings)`,
        reason: `Automatic action — you have reached ${escalation.threshold} warnings`,
        caseNumber,
        duration: dmDuration,
        appealEnabled: config.appealEnabled,
      }).catch(() => {});
    }

    const container = buildModActionContainer({
      action: 'Warning',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
      dmSent,
      extraFields,
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
