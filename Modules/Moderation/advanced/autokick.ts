import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, MessageFlags, TextDisplayBuilder, ContainerBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields } from '../../../Shared/src/utils/componentsV2';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { canModerate, createModCase, ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.autokick',
  data: new SlashCommandBuilder()
    .setName('autokick')
    .setDescription('Auto-kick a user — they get kicked every time they rejoin the server')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to auto-kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for auto-kick')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      // Hierarchy check (only if member is still in the server)
      if (targetMember && !canModerate(interaction.member as GuildMember, targetMember, 'autokick')) {
        await interaction.editReply({
          components: [errorContainer('Cannot moderate this user', 'They are equal or higher in hierarchy')],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Add to auto-kick set (in-memory)
      const autokickSetKey = `autokick:${guild.id}`;
      cache.sadd(autokickSetKey, targetUser.id);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Autokick: ${reason}`,
      });

      // Immediately kick if they're still in the server
      if (targetMember) {
        try {
          await targetMember.kick(`[AUTO-KICK] ${reason}`);
        } catch {
          // Kick failed — they're still on the auto-kick list for next rejoin
        }
      }

      const container = successContainer(`User ${targetUser.tag} has been added to auto-kick`);
      addFields(container, [
        { name: 'Reason', value: reason },
        { name: 'Effect', value: 'This user will be automatically kicked every time they rejoin the server.' },
      ]);

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error in autokick command:', error);
      await interaction.editReply({
        components: [errorContainer('An error occurred while setting up auto-kick')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
} as BotCommand;
