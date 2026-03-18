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

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a user from the server')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to ban')
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
  permissionPath: 'moderation.ban',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const guild = interaction.guild!;
    const moderator = interaction.user;

    // Check if user is in guild
    const targetMember = await guild.members.fetch(target.id).catch(() => null);

    // Hierarchy check (only if target is in guild)
    if (targetMember) {
      const check = canModerate(interaction.member as any, targetMember, 'ban');
      if (check) {
        await interaction.reply({ content: check });
        return;
      }
    }

    // Check if already banned
    const banList = await guild.bans.fetch({ user: target.id }).catch(() => null);
    if (banList) {
      await interaction.reply({ content: 'That user is already banned.' });
      return;
    }

    await interaction.deferReply();

    // Get config
    const config = await getModConfig(guild.id);

    // Enforce requireReason
    if (config.requireReason && !rawReason) {
      await interaction.editReply({ content: '❌ This server requires a reason for moderation actions. Please provide a reason.' });
      return;
    }

    // Ensure records
    await ensureGuild(guild);
    await ensureGuildMember(guild.id, target.id);

    // Create case
    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'ban',
      targetId: target.id,
      moderatorId: moderator.id,
      reason,
    });

    // DM user before ban
    let dmSent = false;
    if (config.dmOnBan) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Ban',
        reason,
        caseNumber,
        appealEnabled: config.appealEnabled,
      });
    }

    // Execute ban
    await guild.members.ban(target.id, {
      reason: `[Case #${caseNumber}] ${reason} (by ${moderator.tag})`,
      deleteMessageSeconds: deleteDays * 86400,
    });

    // Adjust reputation
    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.ban, 'Ban', moderator.id);
    }

    // Currency fine
    await deductFine(guild.id, target.id, 'ban', config);

    // Reply
    const container = buildModActionContainer({
      action: 'Ban',
      target,
      moderator,
      reason,
      caseNumber,
      dmSent,
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
