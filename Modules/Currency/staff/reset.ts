import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers, transactions } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-reset')
    .setDescription('Reset all currency balances to 0 for a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to reset currency for').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ,

  module: 'currency',
  permissionPath: 'currency.reset',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user = interaction.options.getUser('user', true);

      await interaction.deferReply();

      const db = getDb();

      // Update all currency balances to 0
      await db
        .update(guildMembers)
        .set({
          coins: 0,
          gems: 0,
          eventTokens: 0,
        })
        .where(and(eq(guildMembers.guildId, interaction.guildId!), eq(guildMembers.userId, user.id)));

      // Log transactions for each currency type
      await db.insert(transactions).values([
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'coins',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'gems',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'event_tokens',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
      ]);

      const embed = successEmbed(`Currency Reset`)
        .addFields(
          { name: 'User', value: user.toString(), inline: true },
          { name: 'Action', value: 'All balances set to 0', inline: true }
        )
        .setThumbnail(user.avatarURL());

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in reset command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while resetting currency.')],
      });
    }
  },
} as BotCommand;
