import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, moduleContainer, addText, addSeparator, addSectionWithThumbnail, addFooter } from '../../../Shared/src/utils/componentsV2';
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
          components: [errorContainer('No History', 'No transaction history found for this user.')],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const container = moduleContainer('currency');
      addSectionWithThumbnail(container, `### Transaction History for ${user.username}`, user.displayAvatarURL({ size: 256 }));
      addSeparator(container, 'small');
      addText(container, `Showing ${userTransactions.length} transaction${userTransactions.length !== 1 ? 's' : ''}`);
      addSeparator(container, 'small');

      for (const tx of userTransactions) {
        const currencyInfo = config.currencies[tx.currencyType as 'coins' | 'gems' | 'event_tokens'];
        const emoji = tx.amount >= 0 ? '🟢' : '🔴';
        const sign = tx.amount >= 0 ? '+' : '';

        const txDescription = `${emoji} ${sign}${tx.amount} | Balance: ${tx.balance}`;
        const sourceLabel = `${tx.type} (${tx.source})`;
        const timestamp = tx.createdAt ? discordTimestamp(tx.createdAt) : 'Unknown';

        addText(container, `**${currencyInfo.emoji} ${sourceLabel}**\n${txDescription}\n${timestamp}`);
      }

      addFooter(container, `Requested by ${interaction.user.username}`);

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in audit command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while retrieving transaction history.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
