import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers, transactions } from '../../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export default {
	data: new SlashCommandBuilder()
		.setName('economy')
		.setDescription('View the server economy overview'),
	module: 'currency',
	permissionPath: 'currency.economy',
	cooldown: 10,
	execute: async (interaction: ChatInputCommandInteraction) => {
		try {
			const db = getDb();
			const guildId = interaction.guildId!;

			// Get aggregate stats
			const aggregateStats = await db
				.select({
					totalCoins: sql<number>`COALESCE(SUM(${guildMembers.coins}), 0)`,
					totalGems: sql<number>`COALESCE(SUM(${guildMembers.gems}), 0)`,
					averageCoins: sql<number>`COALESCE(AVG(${guildMembers.coins}), 0)`,
					richestAmount: sql<number>`COALESCE(MAX(${guildMembers.coins}), 0)`,
					membersWithCurrency: sql<number>`COUNT(CASE WHEN ${guildMembers.coins} > 0 OR ${guildMembers.gems} > 0 THEN 1 END)`
				})
				.from(guildMembers)
				.where(eq(guildMembers.guildId, guildId));

			const stats = aggregateStats[0];

			// Get richest user
			const richestUser = await db
				.select()
				.from(guildMembers)
				.where(eq(guildMembers.guildId, guildId))
				.orderBy(desc(guildMembers.coins))
				.limit(1);

			// Get total transactions today
			const now = new Date();
			const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

			const transactionsToday = await db
				.select({
					count: sql<number>`COUNT(*)`
				})
				.from(transactions)
				.where(and(
					eq(transactions.guildId, guildId),
					sql`${transactions.createdAt} >= ${startOfDay.toISOString()}`
				));

			const transactionCount = transactionsToday[0]?.count ?? 0;
			const richestUserDisplay = richestUser.length > 0
				? `<@${richestUser[0].userId}> (${richestUser[0].coins.toLocaleString()})`
				: 'N/A';

			const container = moduleContainer('currency');
			addText(container, `### Server Economy Overview`);
			addSeparator(container, 'small');

			addText(container, `**Total Coins in Circulation:** ${stats.totalCoins.toLocaleString()}`);
			addText(container, `**Total Gems in Circulation:** ${stats.totalGems.toLocaleString()}`);
			addText(container, `**Average Coin Balance:** ${Math.round(stats.averageCoins).toLocaleString()}`);
			addText(container, `**Richest User:** ${richestUserDisplay}`);
			addText(container, `**Transactions Today:** ${transactionCount.toLocaleString()}`);
			addText(container, `**Members with Currency:** ${stats.membersWithCurrency.toLocaleString()}`);

			addFooter(container, `Last updated: Now`);

			return await interaction.reply(v2Payload([container]));
		} catch (error) {
			console.error('Error fetching economy stats:', error);
			return await interaction.reply({
				content: 'An error occurred while fetching economy statistics.',
				flags: MessageFlags.Ephemeral
			});
		}
	}
} as BotCommand;
