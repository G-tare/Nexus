import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { transactions } from '../../../Shared/src/database/models/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrencyConfig } from '../helpers';
import { discordTimestamp } from '../../../Shared/src/utils/time';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-audit')
    .setDescription('View transaction history for a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to audit').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('Number of transactions to show')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(50)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  module: 'currency',
  permissionPath: 'currency.audit',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user = interaction.options.getUser('user', true);
      const count = interaction.options.getInteger('count') ?? 20;

      await interaction.deferReply();

      const db = getDb();
      const config = await getCurrencyConfig(interaction.guildId!);

      // Query transactions for this user in this guild
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.guildId, interaction.guildId!),
            eq(transactions.userId, user.id)
          )
        )
        .orderBy(desc(transactions.createdAt))
        .limit(count);

      if (userTransactions.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No transaction history found for this user.')],
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.Economy)
        .setTitle(`Transaction History for ${user.username}`)
        .setThumbnail(user.avatarURL())
        .setDescription(`Showing ${userTransactions.length} transaction${userTransactions.length !== 1 ? 's' : ''}`);

      for (const tx of userTransactions) {
        const currencyInfo = config.currencies[tx.currencyType as 'coins' | 'gems' | 'event_tokens'];
        const emoji = tx.amount >= 0 ? '🟢' : '🔴';
        const sign = tx.amount >= 0 ? '+' : '';

        const txDescription = `${emoji} ${sign}${tx.amount} | Balance: ${tx.balance}`;
        const sourceLabel = `${tx.type} (${tx.source})`;
        const timestamp = tx.createdAt ? discordTimestamp(tx.createdAt) : 'Unknown';

        embed.addFields({
          name: `${currencyInfo.emoji} ${sourceLabel}`,
          value: `${txDescription}\n${timestamp}`,
          inline: false,
        });
      }

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in audit command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while retrieving transaction history.')],
      });
    }
  },
} as BotCommand;
