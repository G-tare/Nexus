import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase, sendModDM, canModerate, buildModActionContainer,
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
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const guild = interaction.guild!;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: 'User not found in this server.' });
      return;
    }

    const check = canModerate(interaction.member as any, targetMember, 'kick');
    if (check) {
      await interaction.reply({ content: check });
      return;
    }

    await interaction.deferReply();

    try {
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
        await adjustReputation(guild.id, target.id, -config.reputationPenalties.kick, 'Kick', interaction.user.id);
      }

      const container = buildModActionContainer({
        action: 'Kick',
        target,
        moderator: interaction.user,
        reason,
        caseNumber,
        dmSent,
      });

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err: any) {
      await interaction.editReply({ content: `❌ Failed to kick user: ${err.message}` }).catch(() => {});
    }
  },
};

export default command;
