import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { canModerate, createModCase, ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.softban',
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Soft ban a user - ban then immediately unban to purge messages')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to soft ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for soft ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('delete_days')
        .setDescription('Days of messages to delete (1-7, default 1)')
        .setMinValue(1)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 1;

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      // Hierarchy check
      if (!canModerate(interaction.member as GuildMember, targetMember, 'softban')) {
        await interaction.editReply({
          embeds: [errorEmbed('Cannot moderate this user - they are equal or higher in hierarchy')]
        });
        return;
      }

      // Ban the user
      await guild.members.ban(targetUser.id, {
        reason: reason,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60
      });

      // Immediately unban
      await guild.bans.remove(targetUser.id, 'Soft ban');

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'softban',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason,
      });

      const embed = successEmbed(`User ${targetUser.tag} has been soft banned`);
      embed.addFields(
        { name: 'Reason', value: reason },
        { name: 'Messages Deleted', value: `Last ${deleteDays} day(s)` }
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in softban command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while soft banning the user')]
      });
    }
  }
} as BotCommand;
