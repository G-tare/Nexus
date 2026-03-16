import { ModuleEvent } from '../../Shared/src/types/command';
import {  Interaction, PermissionFlagsBits, Events, MessageFlags } from 'discord.js';
import {
  getConfessionConfig,
  getPendingConfessionData,
  removePendingConfession,
  storeConfession,
  buildConfessionContainer,
  buildConfessionButtons,
  getNextConfessionNumber,
  checkCooldown,
  setCooldown,
  hashUserId,
  isConfessionBanned,
  checkBlacklist,
  storePendingConfession,
  buildModerationContainer,
} from './helpers';
import { v2Payload } from '../../Shared/src/utils/componentsV2';
import { cache } from '../../Shared/src/cache/cacheManager';
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from 'discord.js';

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
            flags: MessageFlags.Ephemeral,
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
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Check if confession channel is set
          if (!config.channelId) {
            await interaction.reply({
              content: 'Confession channel is not configured.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) {
            await interaction.reply({
              content: 'Confession channel not found.',
              flags: MessageFlags.Ephemeral,
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

          // Post to channel with buttons
          const container = buildConfessionContainer(confessionId, pendingData.content, config);

          const confessionButtons = buildConfessionButtons(confessionId);

          // Remove buttons from the previous confession
          const lastMsgId = cache.get<string>(`confession_last_msg:${guildId}`);
          if (lastMsgId) {
            try {
              const oldMsg = await (channel as TextChannel).messages.fetch(lastMsgId);
              if (oldMsg?.editable) {
                await oldMsg.edit({ components: [] });
              }
            } catch {
              // ignore
            }
          }

          container.addActionRowComponents(confessionButtons);
          const sentMsg = await (channel as any).send(v2Payload([container]));
          cache.set(`confession_last_msg:${guildId}`, sentMsg.id);

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
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      // Handle "Submit Confession" button — opens a modal
      if (customId === 'confession_submit_new') {
        try {
          const config = await getConfessionConfig(guildId);
          if (!config.enabled || !config.channelId) {
            await interaction.reply({
              content: 'Confessions are not enabled or no channel is configured.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const modal = new ModalBuilder()
            .setCustomId('confession_modal')
            .setTitle('Submit a Confession');

          const messageInput = new TextInputBuilder()
            .setCustomId('confession_text')
            .setLabel('Your confession')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type your anonymous confession here...')
            .setMaxLength(2000)
            .setRequired(true);

          const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
          modal.addComponents(row);

          await interaction.showModal(modal);
        } catch (error) {
          console.error('Error showing confession modal:', error);
        }
        return;
      }

      // Handle "Respond" button — creates a thread under the confession
      if (customId.startsWith('confession_respond_')) {
        try {
          const confessionNumber = customId.replace('confession_respond_', '');
          const message = interaction.message;

          if (!message || !message.channel || message.channel.type !== ChannelType.GuildText) {
            await interaction.reply({
              content: 'Cannot create a thread here.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Check if a thread already exists on this message
          const existingThread = message.thread;
          if (existingThread) {
            await interaction.reply({
              content: `A discussion thread already exists: ${existingThread}`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          // Create a thread
          const thread = await message.startThread({
            name: `Confession #${confessionNumber} Discussion`,
            autoArchiveDuration: 1440, // 24 hours
          });

          await thread.send({
            content: `💬 **Discussion thread for Confession #${confessionNumber}**\nFeel free to share your thoughts — all responses are public.`,
          });

          await interaction.reply({
            content: `Discussion thread created: ${thread}`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          console.error('Error creating confession thread:', error);
          await interaction.reply({
            content: 'Failed to create discussion thread.',
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      // Handle deny button
      if (customId.startsWith('confession_deny_')) {
        const confessionId = parseInt(customId.replace('confession_deny_', ''), 10);

        // Check permissions
        if (typeof interaction.member?.permissions !== 'object' || !interaction.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: 'You do not have permission to deny confessions.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        try {
          // Check if pending confession exists
          const pendingData = await getPendingConfessionData(guildId, confessionId);
          if (!pendingData) {
            await interaction.reply({
              content: `Pending confession #${confessionId} not found.`,
              flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    },
  },
  // Modal submission handler for "Submit Confession" button
  {
    event: Events.InteractionCreate,
    once: false,
    handler: async (interaction: Interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (interaction.customId !== 'confession_modal') return;

      const guildId = interaction.guildId!;
      if (!guildId) return;
      const userId = interaction.user.id;

      try {
        const config = await getConfessionConfig(guildId);
        if (!config.enabled || !config.channelId) {
          await interaction.reply({
            content: 'Confessions are currently disabled.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Cooldown check
        const cooldownRemaining = await checkCooldown(guildId, userId);
        if (cooldownRemaining) {
          await interaction.reply({
            content: `You can confess again in ${cooldownRemaining} seconds.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Ban check
        if (await isConfessionBanned(guildId, userId)) {
          await interaction.reply({
            content: 'You are banned from confessing.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const message = interaction.fields.getTextInputValue('confession_text');

        // Blacklist check
        if (checkBlacklist(message, config.blacklistedWords)) {
          await interaction.reply({
            content: 'Your confession contains prohibited content.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const confessionNumber = await getNextConfessionNumber(guildId);
        const userHash = hashUserId(userId, guildId);

        const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({
            content: 'Confession channel not found.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (config.moderationEnabled && config.moderationChannelId) {
          // Send to moderation queue
          await storePendingConfession(guildId, confessionNumber, userHash, message, userId);

          const modChannel = await interaction.client.channels.fetch(config.moderationChannelId).catch(() => null);
          if (modChannel && modChannel.isTextBased()) {
            const container = buildModerationContainer(confessionNumber, message, config);
            const modButtons = new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder().setCustomId(`confession_approve_${confessionNumber}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`confession_deny_${confessionNumber}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
              );
            container.addActionRowComponents(modButtons);
            await (modChannel as any).send(v2Payload([container]));
          }

          await interaction.reply({
            content: 'Your confession has been submitted for review.',
            flags: MessageFlags.Ephemeral,
          });
        } else {
          // Post directly
          await storeConfession(guildId, confessionNumber, userHash, message, userId);

          const container = buildConfessionContainer(confessionNumber, message, config);
          const buttons = buildConfessionButtons(confessionNumber);

          // Remove buttons from previous confession
          const lastMsgId = cache.get<string>(`confession_last_msg:${guildId}`);
          if (lastMsgId) {
            try {
              const oldMsg = await (channel as TextChannel).messages.fetch(lastMsgId);
              if (oldMsg?.editable) {
                await oldMsg.edit({ components: [] });
              }
            } catch {
              // ignore
            }
          }

          container.addActionRowComponents(buttons);
          const sentMsg = await (channel as any).send(v2Payload([container]));
          cache.set(`confession_last_msg:${guildId}`, sentMsg.id);

          await interaction.reply({
            content: `Confession #${confessionNumber} submitted!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await setCooldown(guildId, userId, config.cooldownSeconds);
      } catch (error) {
        console.error('Error handling confession modal:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Failed to post confession.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    },
  },
];
