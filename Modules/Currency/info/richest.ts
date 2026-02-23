import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, desc } from 'drizzle-orm';

const ITEMS_PER_PAGE = 10;

export default {
	data: new SlashCommandBuilder()
		.setName('richest')
		.setDescription('View the richest users in the server')
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('Currency type to sort by')
				.setRequired(false)
				.addChoices(
					{ name: 'Coins', value: 'coins' },
					{ name: 'Gems', value: 'gems' },
					{ name: 'Event Tokens', value: 'event_tokens' }
				)
		)
		.addIntegerOption((option) =>
			option
				.setName('page')
				.setDescription('Page number (1+)')
				.setRequired(false)
				.setMinValue(1)
		),
	module: 'currency',
	permissionPath: 'currency.richest',
	cooldown: 5,
	execute: async (interaction: ChatInputCommandInteraction) => {
		const currencyType = (interaction.options.getString('type') ?? 'coins') as 'coins' | 'gems' | 'event_tokens';
		const page = interaction.options.getInteger('page') ?? 1;
		const pageIndex = page - 1;
		const offsetValue = pageIndex * ITEMS_PER_PAGE;

		try {
			const db = getDb();
			const guildId = interaction.guildId!;

			// Determine which column to sort by
			let sortColumn: any;
			if (currencyType === 'coins') {
				sortColumn = guildMembers.coins;
			} else if (currencyType === 'gems') {
				sortColumn = guildMembers.gems;
			} else {
				sortColumn = guildMembers.eventTokens;
			}

			// Query for total count
			const totalResults = await db
				.select()
				.from(guildMembers)
				.where(eq(guildMembers.guildId, guildId));

			const totalPages = Math.ceil(totalResults.length / ITEMS_PER_PAGE);

			if (page > totalPages && totalPages > 0) {
				return await interaction.reply({
					content: `Page ${page} does not exist. Maximum page is ${totalPages}.`,
					ephemeral: true
				});
			}

			// Query for leaderboard
			const richestUsers = await db
				.select()
				.from(guildMembers)
				.where(eq(guildMembers.guildId, guildId))
				.orderBy(desc(sortColumn))
				.limit(ITEMS_PER_PAGE)
				.offset(offsetValue);

			let leaderboardText = '';
			richestUsers.forEach((member, index) => {
				const rank = pageIndex * ITEMS_PER_PAGE + index + 1;
				const amount = currencyType === 'coins' ? member.coins : currencyType === 'gems' ? member.gems : member.eventTokens;
				leaderboardText += `**${rank}.** <@${member.userId}> - ${amount.toLocaleString()} ${currencyType}\n`;
			});

			if (!leaderboardText) {
				leaderboardText = 'No users found.';
			}

			const currencyLabel =
				currencyType === 'coins' ? 'Coins' : currencyType === 'gems' ? 'Gems' : 'Event Tokens';

			const embed = new EmbedBuilder()
				.setTitle(`${currencyLabel} Leaderboard`)
				.setDescription(leaderboardText)
				.setColor(Colors.Economy)
				.setFooter({
					text: `Page ${page}/${totalPages} | Total users: ${totalResults.length}`
				})
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching richest users:', error);
			return await interaction.reply({
				content: 'An error occurred while fetching the leaderboard.',
				ephemeral: true
			});
		}
	}
} as BotCommand;
