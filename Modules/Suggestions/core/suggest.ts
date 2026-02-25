import { 
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import premiumCheck from '../../../Shared/src/middleware/premiumCheck';
import { getRedis } from '../../../Shared/src/database/connection';
import {
  getSuggestionConfig,
  getNextSuggestionNumber,
  storeSuggestion,
  buildSuggestionEmbed,
  addVoteReactions,
  storeSuggestionThread,
} from '../helpers';

const redis = getRedis();

const suggest: BotCommand = {
  module: 'suggestions',
  permissionPath: 'suggestions.suggest',
  category: 'engagement',
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion for the server')
    .addStringOption((option) =>
      option
        .setName('suggestion')
        .setDescription('Your suggestion (max 2000 characters)')
        .setRequired(true)
        .setMaxLength(2000),
    )
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Optional image to attach to your suggestion')
        .setRequired(false),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Premium check
      const hasFeature = await premiumCheck.hasFeature(interaction.guildId!, 'suggestions.basic');
      if (!hasFeature) {
        await interaction.reply({
          content: 'The Suggestions module is a premium feature.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if suggestions are enabled
      const config = await getSuggestionConfig(interaction.guildId!);
      if (!config.enabled) {
        await interaction.reply({
          content: 'Suggestions are disabled on this server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if channel is set
      if (!config.channelId) {
        await interaction.reply({
          content: 'Suggestions channel has not been configured. Contact staff to set it up.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Cooldown check (60s)
      const cooldownKey = `suggestions:cooldown:${interaction.guildId!}:${interaction.user.id}`;
      const onCooldown = await redis.get(cooldownKey);

      if (onCooldown) {
        const ttl = await redis.ttl(cooldownKey);
        await interaction.reply({
          content: `You're on cooldown! Try again in ${ttl}s.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const suggestion = interaction.options.getString('suggestion') || '';
      const imageAttachment = interaction.options.getAttachment('image');

      if (!suggestion) {
        await interaction.reply({
          content: 'Please provide a suggestion.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Get next suggestion number
      const suggestNumber = await getNextSuggestionNumber(interaction.guildId!);

      // Build embed
      const authorName = config.anonymous ? 'Anonymous' : interaction.user.username;
      const embed = buildSuggestionEmbed(suggestNumber, suggestion, authorName, config, 'pending');

      if (imageAttachment && imageAttachment.contentType?.startsWith('image')) {
        embed.setImage(imageAttachment.url);
      }

      // Get suggestion channel
      const channel = (await interaction.guild!.channels.fetch(config.channelId)) as TextChannel;
      if (!channel) {
        await interaction.reply({
          content: 'Suggestion channel not found. Contact staff to reconfigure.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Send suggestion to channel
      const message = await (channel as any).send({ embeds: [embed] });

      // Add vote reactions
      await addVoteReactions(message, config);

      // Create discussion thread if enabled
      if (config.autoThread) {
        try {
          const thread = await message.startThread({
            name: `Discussion: Suggestion #${suggestNumber}`,
            autoArchiveDuration: 1440, // 24 hours
          });
          await storeSuggestionThread(interaction.guildId!, suggestNumber, thread.id);
        } catch (error) {
          console.error('Failed to create suggestion thread:', error);
        }
      }

      // Store suggestion data
      await storeSuggestion(
        interaction.guildId!,
        suggestNumber,
        interaction.user.id,
        suggestion,
        message.id,
        imageAttachment && imageAttachment.contentType?.startsWith('image') ? imageAttachment.url : undefined,
      );

      // Set cooldown
      await redis.setex(cooldownKey, 60, '1');

      // Reply to user
      await interaction.reply({
        content: `✅ Your suggestion #${suggestNumber} has been submitted!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error in suggest command:', error);
      await interaction.reply({
        content: 'An error occurred while submitting your suggestion.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default suggest;
