import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRedis } from '../../../Shared/src/database/connection';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const validStyles = ['default', 'minimal', 'neon', 'galaxy', 'pastel'];

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.customize.cardstyle',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('cardstyle')
    .setDescription('Choose your rank card style')
    .addStringOption(option =>
      option
        .setName('style')
        .setDescription('The card style to use')
        .setRequired(true)
        .addChoices(
          { name: 'Default', value: 'default' },
          { name: 'Minimal', value: 'minimal' },
          { name: 'Neon', value: 'neon' },
          { name: 'Galaxy', value: 'galaxy' },
          { name: 'Pastel', value: 'pastel' }
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      const userId = interaction.user.id;
      const style = interaction.options.getString('style', true);

      // Validate style
      if (!validStyles.includes(style)) {
        return interaction.editReply({
          embeds: [errorEmbed('Invalid Style', 'That card style is not available.')]
        });
      }

      // Determine premium requirement
      const isPremium = style === 'default' || style === 'minimal';
      const premiumFeature = isPremium ? 'leveling.basic' : 'leveling.advanced';

      // TODO: Add premium check here using permission system
      // For now, we'll allow it and save to Redis

      // Save to Redis
      const redis = getRedis();
      const key = `cardstyle:${guildId}:${userId}`;
      await redis.setex(key, 7 * 24 * 60 * 60, style); // 7 days expiry

      // Create success embed with style info
      const styleDescriptions: Record<string, string> = {
        default: 'Clean and professional, shows all essential rank information',
        minimal: 'Streamlined design with just the essentials',
        neon: 'Vibrant neon colors with glowing effects (Premium)',
        galaxy: 'Cosmic space theme with star effects (Premium)',
        pastel: 'Soft pastel colors with a calming aesthetic (Premium)'
      };

      const embed = successEmbed('Card Style Updated', styleDescriptions[style])
        .setColor(Colors.Leveling)
        .addFields(
          { name: 'Style', value: `\`${style}\``, inline: true },
          { name: 'Premium', value: isPremium ? 'No' : 'Yes', inline: true }
        )
        .setFooter({ text: 'Your rank card style will be updated next time you view your rank' });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[CardStyle Command Error]', error);
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'An error occurred while updating your card style.')]
      });
    }
  }
};

export default command;
