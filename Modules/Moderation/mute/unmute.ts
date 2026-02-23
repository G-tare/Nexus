import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModCase, modActionEmbed, ensureGuild } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to unmute').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the unmute').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.unmute',
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

    if (!targetMember.isCommunicationDisabled()) {
      await interaction.reply({ content: 'That user is not muted.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await ensureGuild(guild);

    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'unmute',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });

    await targetMember.timeout(null, `[Case #${caseNumber}] ${reason} (by ${interaction.user.tag})`);

    const embed = modActionEmbed({
      action: 'Unmute',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
