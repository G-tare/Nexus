import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase,
  sendModDM,
  canModerate,
  buildModActionContainer,
  getModConfig,
  ensureGuild,
  ensureGuildMember,
  adjustReputation,
  deductFine,
} from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { getPool } from '../../../Shared/src/database/connection';
import { timers } from '../../../Shared/src/cache/timerManager';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user from the server')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to temporarily ban')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Ban duration (e.g., 1h, 2d, 1w)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the ban')
        .setMaxLength(512))
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.tempban',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const guild = interaction.guild!;

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000) { // Minimum 1 minute
      await interaction.reply({ content: 'Invalid duration. Use formats like: 1h, 2d, 1w' });
      return;
    }

    const durationSeconds = Math.floor(durationMs / 1000);

    // Hierarchy check
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (targetMember) {
      const check = canModerate(interaction.member as any, targetMember, 'tempban');
      if (check) {
        await interaction.reply({ content: check });
        return;
      }
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

    // Create case
    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'tempban',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
      duration: durationSeconds,
    });

    // DM before ban
    let dmSent = false;
    if (config.dmOnBan) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Temporary Ban',
        reason,
        caseNumber,
        duration: formatDuration(durationMs),
        appealEnabled: config.appealEnabled,
      });
    }

    // Execute ban
    await guild.members.ban(target.id, {
      reason: `[Case #${caseNumber}] [TEMPBAN: ${formatDuration(durationMs)}] ${reason} (by ${interaction.user.tag})`,
      deleteMessageSeconds: deleteDays * 86400,
    });

    // Store in Postgres and schedule unban via TimerManager
    const expiresAt = new Date(Date.now() + durationMs);
    const pool = getPool();
    await pool.query(
      `INSERT INTO temp_bans (guild_id, user_id, moderator_id, reason, case_number, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [guild.id, target.id, interaction.user.id, reason, caseNumber, expiresAt],
    );

    const timerId = `tempban:${guild.id}:${target.id}`;
    timers.schedule(timerId, expiresAt, async () => {
      try {
        const g = interaction.client.guilds.cache.get(guild.id);
        if (g) {
          await g.members.unban(target.id, '[AUTO] Temporary ban expired');
        }
        await pool.query(
          'DELETE FROM temp_bans WHERE guild_id = $1 AND user_id = $2',
          [guild.id, target.id],
        ).catch(() => null);
      } catch {
        // User might already be unbanned
      }
    });

    // Adjust reputation
    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -(config.reputationPenalties.tempban ?? config.reputationPenalties.ban), 'Temporary ban', interaction.user.id);
    }

    // Currency fine (uses 'ban' fine amount for tempbans)
    await deductFine(guild.id, target.id, 'ban', config);

    const container = buildModActionContainer({
      action: 'Temporary Ban',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
      duration: formatDuration(durationMs),
      dmSent,
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
