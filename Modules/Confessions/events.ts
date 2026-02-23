import { ModuleEvent } from '../../Shared/src/types/command';
import { Interaction, PermissionFlagsBits, Events } from 'discord.js';
import {
  getConfessionConfig,
  getPendingConfessionData,
  removePendingConfession,
  storeConfession,
  buildConfessionEmbed,
} from './helpers';

export const confessionsEvents: ModuleEvent[] = [
  { event: Events.InteractionCreate,
    once: false,
    handler: async (interaction: Interaction) => {
      if (!interaction.isButton()) return;

      const guildId = interaction.guildId!;
      if (!guildId) return;

      const customId = interaction.customId;

      // Handle approve button
      if (customId.startsWith('confession_approve_')) {
        const confessionId = parseInt(customId.replace('confession_approve_', ''), 10);

        // Check permissions
        if (typeof interaction.member?.permissions !== 'object' || !interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: 'You do not have permission to approve confessions.',
            ephemeral: true,
          });
          return;
        }

        try {
          const config = await getConfessionConfig(guildId);

          // Get pending confession
          const pendingData = await getPendingConfessionData(guildId, confessionId);
          if (!pendingData) {
            await interaction.reply({
              content: `Pending confession #${confessionId} not found.`,
              ephemeral: true,
            });
            return;
          }

          // Check if confession channel is set
          if (!config.channelId) {
            await interaction.reply({
              content: 'Confession channel is not configured.',
              ephemeral: true,
            });
            return;
          }

          const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) {
            await interaction.reply({
              content: 'Confession channel not found.',
              ephemeral: true,
            });
            return;
          }

          // Store as approved confession
          await storeConfession(
            guildId,
            confessionId,
            pendingData.userHash,
            pendingData.content,
            pendingData.userId,
            pendingData.imageUrl
          );

          // Post to channel
          const embed = buildConfessionEmbed(confessionId, pendingData.content, config);
          if (pendingData.imageUrl) {
            embed.setImage(pendingData.imageUrl);
          }

          await (channel as any).send({ embeds: [embed] });

          // Remove from pending
          await removePendingConfession(guildId, confessionId);

          // Edit the moderation message
          await interaction.update({
            content: `✅ Confession #${confessionId} approved and posted.`,
            components: [],
          });
        } catch (error) {
          console.error('Error approving confession via button:', error);
          await interaction.reply({
            content: 'Failed to approve confession.',
            ephemeral: true,
          });
        }
      }

      // Handle deny button
      if (customId.startsWith('confession_deny_')) {
        const confessionId = parseInt(customId.replace('confession_deny_', ''), 10);

        // Check permissions
        if (typeof interaction.member?.permissions !== 'object' || !interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: 'You do not have permission to deny confessions.',
            ephemeral: true,
          });
          return;
        }

        try {
          // Check if pending confession exists
          const pendingData = await getPendingConfessionData(guildId, confessionId);
          if (!pendingData) {
            await interaction.reply({
              content: `Pending confession #${confessionId} not found.`,
              ephemeral: true,
            });
            return;
          }

          // Remove from pending
          await removePendingConfession(guildId, confessionId);

          // Edit the moderation message
          await interaction.update({
            content: `❌ Confession #${confessionId} denied.`,
            components: [],
          });
        } catch (error) {
          console.error('Error denying confession via button:', error);
          await interaction.reply({
            content: 'Failed to deny confession.',
            ephemeral: true,
          });
        }
      }
    },
  },
];
