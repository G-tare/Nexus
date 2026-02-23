import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';
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

			const embed = new EmbedBuilder()
				.setTitle('Server Economy Overview')
				.setColor(Colors.Economy)
				.addFields(
					{
						name: 'Total Coins in Circulation',
						value: stats.totalCoins.toLocaleString(),
						inline: true
					},
					{
						name: 'Total Gems in Circulation',
						value: stats.totalGems.toLocaleString(),
						inline: true
					},
					{
						name: 'Average Coin Balance',
						value: Math.round(stats.averageCoins).toLocaleString(),
						inline: true
					},
					{
						name: 'Richest User',
						value: richestUserDisplay,
						inline: true
					},
					{
						name: 'Transactions Today',
						value: transactionCount.toLocaleString(),
						inline: true
					},
					{
						name: 'Members with Currency',
						value: stats.membersWithCurrency.toLocaleString(),
						inline: true
					}
				)
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching economy stats:', error);
			return await interaction.reply({
				content: 'An error occurred while fetching economy statistics.',
				ephemeral: true
			});
		}
	}
} as BotCommand;
