import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase,
  sendModDM,
  canModerate,
  modActionEmbed,
  getModConfig,
  ensureGuild,
  ensureGuildMember,
  adjustReputation,
} from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { getRedis } from '../../../Shared/src/database/connection';

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
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const guild = interaction.guild!;

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000) { // Minimum 1 minute
      await interaction.reply({ content: 'Invalid duration. Use formats like: 1h, 2d, 1w', ephemeral: true });
      return;
    }

    const durationSeconds = Math.floor(durationMs / 1000);

    // Hierarchy check
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (targetMember) {
      const check = canModerate(interaction.member as any, targetMember, 'tempban');
      if (check) {
        await interaction.reply({ content: check, ephemeral: true });
        return;
      }
    }

    await interaction.deferReply();

    const config = await getModConfig(guild.id);
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

    // Schedule unban via Redis
    const redis = getRedis();
    await redis.setex(
      `tempban:${guild.id}:${target.id}`,
      durationSeconds,
      JSON.stringify({ caseNumber, moderatorId: interaction.user.id })
    );

    // Adjust reputation
    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.ban);
    }

    const embed = modActionEmbed({
      action: 'Temporary Ban',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
      duration: formatDuration(durationMs),
      dmSent,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
