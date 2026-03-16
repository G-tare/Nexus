import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
  MessageFlags,
  TextChannel } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { cache } from '../../../Shared/src/cache/cacheManager';
import {
  getConfessionConfig,
  getNextConfessionNumber,
  hashUserId,
  isConfessionBanned,
  checkBlacklist,
  storeConfession,
  buildConfessionContainer,
  buildConfessionButtons,
  buildModerationContainer,
  storePendingConfession,
  checkCooldown,
  setCooldown,
} from '../helpers';
import { v2Payload } from '../../../Shared/src/utils/componentsV2';


const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.confess',
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Submit an anonymous confession')
    .addStringOption(opt =>
      opt
        .setName('message')
        .setDescription('Your confession (max 2000 characters)')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addAttachmentOption(opt =>
      opt
        .setName('image')
        .setDescription('Optional image attachment')
        .setRequired(false)
    ),
  premiumFeature: 'confessions.basic',
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const message = interaction.options.getString('message', true);
    const imageAttachment = interaction.options.getAttachment('image', false);

    // Check if module is enabled
    const config = await getConfessionConfig(guildId);
    if (!config.enabled) {
      await interaction.reply({
        content: 'Confessions are not enabled on this server.',
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

    // Check cooldown
    const cooldownRemaining = await checkCooldown(guildId, userId);
    if (cooldownRemaining) {
      await interaction.reply({
        content: `You can confess again in ${cooldownRemaining} seconds.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if user is banned
    const isBanned = await isConfessionBanned(guildId, userId);
    if (isBanned) {
      await interaction.reply({
        content: 'You are banned from confessing.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check blacklist
    if (checkBlacklist(message, config.blacklistedWords)) {
      await interaction.reply({
        content: 'Your confession contains prohibited content.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check images if enabled
    if (imageAttachment && !config.allowImages) {
      await interaction.reply({
        content: 'Image attachments are not allowed.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get next confession number
    const confessionNumber = await getNextConfessionNumber(guildId);
    const userHash = hashUserId(userId, guildId);

    // Detect if running inside a confession "Respond" thread
    const currentChannel = interaction.channel;
    const isInConfessionThread =
      currentChannel?.isThread() &&
      currentChannel.parentId === config.channelId &&
      currentChannel.name.startsWith('Confession #');

    // Get the confession channel
    const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Confession channel not found.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Handle image URL
      let imageUrl: string | undefined;
      if (imageAttachment && config.allowImages) {
        imageUrl = imageAttachment.url;
      }

      // If inside a Respond thread, post the confession directly in that thread
      if (isInConfessionThread && currentChannel?.isThread()) {
        await storeConfession(guildId, confessionNumber, userHash, message, userId, imageUrl);

        const container = buildConfessionContainer(confessionNumber, message, config);

        await currentChannel.send(v2Payload([container]));

        await interaction.reply({
          content: `Confession #${confessionNumber} posted in this thread!`,
          flags: MessageFlags.Ephemeral,
        });

        await setCooldown(guildId, userId, config.cooldownSeconds);
        return;
      }

      if (config.moderationEnabled && config.moderationChannelId) {
        // Store as pending
        await storePendingConfession(guildId, confessionNumber, userHash, message, userId, imageUrl);

        // Send to moderation channel
        const modChannel = await interaction.client.channels.fetch(config.moderationChannelId).catch(() => null);
        if (modChannel && modChannel.isTextBased()) {
          const container = buildModerationContainer(confessionNumber, message, config);

          const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`confession_approve_${confessionNumber}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`confession_deny_${confessionNumber}`)
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
            );

          container.addActionRowComponents(buttons);
          await (modChannel as any).send(v2Payload([container]));
        }

        await interaction.reply({
          content: `Your confession has been submitted for review. You'll be notified when it's posted.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // Post directly
        await storeConfession(guildId, confessionNumber, userHash, message, userId, imageUrl);

        const container = buildConfessionContainer(confessionNumber, message, config);

        const buttons = buildConfessionButtons(confessionNumber);

        // Remove buttons from the previous confession (if any)
        const lastMsgId = cache.get<string>(`confession_last_msg:${guildId}`);
        if (lastMsgId) {
          try {
            const oldMsg = await (channel as TextChannel).messages.fetch(lastMsgId);
            if (oldMsg?.editable) {
              await oldMsg.edit({ components: [] });
            }
          } catch {
            // Old message may have been deleted — ignore
          }
        }

        container.addActionRowComponents(buttons);
        const sentMsg = await (channel as any).send(v2Payload([container]));

        // Track this message as the latest confession for button removal
        cache.set(`confession_last_msg:${guildId}`, sentMsg.id);

        await interaction.reply({
          content: `Confession #${confessionNumber} submitted!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Set cooldown
      await setCooldown(guildId, userId, config.cooldownSeconds);
    } catch (error) {
      console.error('Error posting confession:', error);
      await interaction.reply({
        content: 'Failed to post confession.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
