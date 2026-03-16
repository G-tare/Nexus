import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase, sendModDM, canModerate, buildModActionContainer,
  getModConfig, ensureGuild, ensureGuildMember, adjustReputation,
} from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user (prevent them from sending messages)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to mute').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Mute duration (e.g., 10m, 1h, 1d). Max 28 days.').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the mute').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.mute',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const guild = interaction.guild!;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: 'User not found in this server.' });
      return;
    }

    const check = canModerate(interaction.member as any, targetMember, 'mute');
    if (check) {
      await interaction.reply({ content: check });
      return;
    }

    // Parse duration (Discord max timeout: 28 days)
    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      await interaction.reply({
        content: 'Invalid duration. Must be between 1 minute and 28 days (e.g., 10m, 1h, 7d).',
      });
      return;
    }

    if (targetMember.isCommunicationDisabled()) {
      await interaction.reply({ content: 'That user is already muted.' });
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

    const durationSeconds = Math.floor(durationMs / 1000);

    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'mute',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
      duration: durationSeconds,
    });

    let dmSent = false;
    if (config.dmOnMute) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Mute (Timeout)',
        reason,
        caseNumber,
        duration: formatDuration(durationMs),
        appealEnabled: config.appealEnabled,
      });
    }

    // Execute timeout
    try {
      await targetMember.timeout(durationMs, `[Case #${caseNumber}] ${reason} (by ${interaction.user.tag})`);
    } catch (err: any) {
      const msg = err?.code === 50013
        ? 'I do not have permission to timeout that user. They may have Administrator permission, which Discord prevents timing out.'
        : `Failed to mute user: ${err?.message || 'Unknown error'}`;
      await interaction.editReply({ content: msg });
      return;
    }

    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.mute, 'Mute', interaction.user.id);
    }

    const container = buildModActionContainer({
      action: 'Mute',
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
