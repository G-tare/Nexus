import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModCase, buildModActionContainer, ensureGuild } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(opt =>
      opt.setName('user_id')
        .setDescription('The user ID to unban')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the unban')
        .setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.unban',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild!;

    // Validate user ID format
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: 'Invalid user ID format.' });
      return;
    }

    // Check if user is actually banned
    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.reply({ content: 'That user is not banned.' });
      return;
    }

    await interaction.deferReply();
    await ensureGuild(guild);

    // Create case
    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'unban',
      targetId: userId,
      moderatorId: interaction.user.id,
      reason,
    });

    // Execute unban
    await guild.members.unban(userId, `[Case #${caseNumber}] ${reason} (by ${interaction.user.tag})`);

    const container = buildModActionContainer({
      action: 'Unban',
      target: ban.user,
      moderator: interaction.user,
      reason,
      caseNumber,
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
