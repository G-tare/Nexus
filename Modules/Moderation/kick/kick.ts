import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase, sendModDM, canModerate, modActionEmbed,
  getModConfig, ensureGuild, ensureGuildMember, adjustReputation,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the kick').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.kick',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild!;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: 'User not found in this server.', ephemeral: true });
      return;
    }

    const check = canModerate(interaction.member as any, targetMember, 'kick');
    if (check) {
      await interaction.reply({ content: check, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const config = await getModConfig(guild.id);
    await ensureGuild(guild);
    await ensureGuildMember(guild.id, target.id);

    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'kick',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });

    let dmSent = false;
    if (config.dmOnKick) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Kick',
        reason,
        caseNumber,
        appealEnabled: config.appealEnabled,
      });
    }

    await targetMember.kick(`[Case #${caseNumber}] ${reason} (by ${interaction.user.tag})`);

    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.kick);
    }

    const embed = modActionEmbed({
      action: 'Kick',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
      dmSent,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
