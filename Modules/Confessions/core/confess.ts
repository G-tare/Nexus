import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getConfessionConfig,
  getNextConfessionNumber,
  hashUserId,
  isConfessionBanned,
  checkBlacklist,
  storeConfession,
  buildConfessionEmbed,
  buildModerationEmbed,
  storePendingConfession,
  checkCooldown,
  setCooldown,
} from '../helpers';


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

    // Check cooldown
    const cooldownRemaining = await checkCooldown(guildId, userId);
    if (cooldownRemaining) {
      await interaction.reply({
        content: `You can confess again in ${cooldownRemaining} seconds.`,
        ephemeral: true,
      });
      return;
    }

    // Check if user is banned
    const isBanned = await isConfessionBanned(guildId, userId);
    if (isBanned) {
      await interaction.reply({
        content: 'You are banned from confessing.',
        ephemeral: true,
      });
      return;
    }

    // Check blacklist
    if (checkBlacklist(message, config.blacklistedWords)) {
      await interaction.reply({
        content: 'Your confession contains prohibited content.',
        ephemeral: true,
      });
      return;
    }

    // Check images if enabled
    if (imageAttachment && !config.allowImages) {
      await interaction.reply({
        content: 'Image attachments are not allowed.',
        ephemeral: true,
      });
      return;
    }

    // Get next confession number
    const confessionNumber = await getNextConfessionNumber(guildId);
    const userHash = hashUserId(userId, guildId);

    // Get the confession channel
    const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: 'Confession channel not found.',
        ephemeral: true,
      });
      return;
    }

    try {
      // Handle image URL
      let imageUrl: string | undefined;
      if (imageAttachment && config.allowImages) {
        imageUrl = imageAttachment.url;
      }

      if (config.moderationEnabled && config.moderationChannelId) {
        // Store as pending
        await storePendingConfession(guildId, confessionNumber, userHash, message, userId, imageUrl);

        // Send to moderation channel
        const modChannel = await interaction.client.channels.fetch(config.moderationChannelId).catch(() => null);
        if (modChannel && modChannel.isTextBased()) {
          const embed = buildModerationEmbed(confessionNumber, message, config);
          if (imageUrl) {
            embed.setImage(imageUrl);
          }

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

          await (modChannel as any).send({ embeds: [embed], components: [buttons] });
        }

        await interaction.reply({
          content: `Your confession has been submitted for review. You'll be notified when it's posted.`,
          ephemeral: true,
        });
      } else {
        // Post directly
        await storeConfession(guildId, confessionNumber, userHash, message, userId, imageUrl);

        const embed = buildConfessionEmbed(confessionNumber, message, config);
        if (imageUrl) {
          embed.setImage(imageUrl);
        }

        await (channel as any).send({ embeds: [embed] });

        await interaction.reply({
          content: `Confession #${confessionNumber} submitted!`,
          ephemeral: true,
        });
      }

      // Set cooldown
      await setCooldown(guildId, userId, config.cooldownSeconds);
    } catch (error) {
      console.error('Error posting confession:', error);
      await interaction.reply({
        content: 'Failed to post confession.',
        ephemeral: true,
      });
    }
  },
};

export default command;
