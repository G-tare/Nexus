import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRedis } from '../../../Shared/src/database/connection';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const validImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/**
 * Validates if a URL appears to be a valid image URL.
 */
function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Check if URL ends with valid image extension
    for (const ext of validImageExtensions) {
      if (pathname.endsWith(`.${ext}`)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.customize.cardbg',
  premiumFeature: 'leveling.advanced',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('cardbg')
    .setDescription('Set a custom background for your rank card')
    .addStringOption(option =>
      option
        .setName('url')
        .setDescription('Image URL for your rank card background')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('reset')
        .setDescription('Reset to default background')
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const url = interaction.options.getString('url');
      const reset = interaction.options.getBoolean('reset');

      const redis = getRedis();
      const key = `cardbg:${guildId}:${userId}`;

      // Handle reset
      if (reset) {
        await redis.del(key);
        return interaction.editReply({
          embeds: [
            successEmbed('Background Reset', 'Your rank card background has been reset to default.')
              .setColor(Colors.Leveling)
          ]
        });
      }

      // Handle URL setting
      if (url) {
        // Validate URL format
        if (!isValidImageUrl(url)) {
          return interaction.editReply({
            embeds: [
              errorEmbed(
                'Invalid Image URL',
                'The URL must be a valid image link (PNG, JPG, JPEG, GIF, or WebP).'
              )
            ]
          });
        }

        // Validate URL is accessible (basic check)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          if (!response.ok) {
            return interaction.editReply({
              embeds: [
                errorEmbed(
                  'Image Unreachable',
                  'The image URL is not accessible. Please check the link and try again.'
                )
              ]
            });
          }
        } catch {
          return interaction.editReply({
            embeds: [
              errorEmbed(
                'Image Unreachable',
                'Unable to reach the image URL. Please ensure it\'s a valid, public link.'
              )
            ]
          });
        }

        // Save to Redis with 7-day expiry
        await redis.setex(key, 7 * 24 * 60 * 60, url);

        return interaction.editReply({
          embeds: [
            successEmbed('Background Updated', 'Your custom rank card background has been saved.')
              .setColor(Colors.Leveling)
              .setImage(url)
              .setFooter({ text: 'Your background will appear on your next rank card' })
          ]
        });
      }

      // No URL or reset provided
      return interaction.editReply({
        embeds: [
          errorEmbed(
            'Missing Option',
            'Please provide either a `url` to set a background or use `reset` to restore the default.'
          )
        ]
      });
    } catch (error) {
      console.error('[CardBg Command Error]', error);
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while updating your card background.')]
      });
    }
  }
};

export default command;
