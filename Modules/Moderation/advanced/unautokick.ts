import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields } from '../../../Shared/src/utils/componentsV2';
import { cache } from '../../../Shared/src/cache/cacheManager';
import { createModCase, ensureGuild } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.unautokick',
  data: new SlashCommandBuilder()
    .setName('unautokick')
    .setDescription('Remove auto-kick from a user — they can rejoin the server normally')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to remove auto-kick from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing auto-kick')
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
      const autokickSetKey = `autokick:${guild.id}`;

      // Check if user is on auto-kick list before removing
      if (!cache.sismember(autokickSetKey, targetUser.id)) {
        await interaction.editReply({
          components: [errorContainer('User is not on the auto-kick list')],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      cache.srem(autokickSetKey, targetUser.id);

      // Create mod case
      await createModCase({
        guildId: guild.id,
        action: 'note',
        targetId: targetUser.id,
        moderatorId: interaction.user.id,
        reason: `Unautokick: ${reason}`,
      });

      const container = successContainer(`User ${targetUser.tag} has been removed from auto-kick`);
      addFields(container, [{ name: 'Reason', value: reason }]);

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error in unautokick command:', error);
      await interaction.editReply({
        components: [errorContainer('An error occurred while removing auto-kick')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
} as BotCommand;
