import { SlashCommandBuilder, ChatInputCommandInteraction, PresenceStatus, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';

export default {
	data: new SlashCommandBuilder()
		.setName('membercount')
		.setDescription('Show current member count and join statistics')
		.addIntegerOption((option) =>
			option
				.setName('days')
				.setDescription('Number of days to check for recent joins/leaves (default 7)')
				.setMinValue(1)
				.setMaxValue(90)
				.setRequired(false)
		)
		,

	module: 'welcome',
	permissionPath: 'welcome.membercount',
	premiumFeature: 'welcome.basic',

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply();

		try {
			const guild = interaction.guild;
			if (!guild) {
				return await interaction.editReply(
					'This command can only be used in a server.'
				);
			}

			const days = interaction.options.getInteger('days') ?? 7;
			const now = Date.now();
			const daysInMs = days * 24 * 60 * 60 * 1000;
			const timeThreshold = now - daysInMs;

			// Fetch fresh member data
			const members = await guild.members.fetch();

			// Count status presences
			let online = 0;
			let offline = 0;
			let idle = 0;
			let dnd = 0;

			members.forEach((member) => {
				const status = member.presence?.status;
				if (status === 'online') online++;
				else if (status === 'idle') idle++;
				else if (status === 'dnd') dnd++;
				else offline++;
			});

			// Count humans vs bots
			let humans = 0;
			let bots = 0;

			members.forEach((member) => {
				if (member.user.bot) {
					bots++;
				} else {
					humans++;
				}
			});

			// Count members joined in last X days
			let recentJoins = 0;
			members.forEach((member) => {
				if (member.joinedAt && member.joinedAt.getTime() > timeThreshold) {
					recentJoins++;
				}
			});

			// Build the embed
			const embed = new EmbedBuilder()
				.setColor((Colors as any).Welcome || '#5865F2')
				.setTitle(`${guild.name} Member Statistics`)
				.setThumbnail(guild.iconURL({ size: 256 }))
				.addFields(
					{
						name: '📊 Total Members',
						value: `${members.size}`,
						inline: true,
					},
					{
						name: '👤 Humans',
						value: `${humans}`,
						inline: true,
					},
					{
						name: '🤖 Bots',
						value: `${bots}`,
						inline: true,
					},
					{
						name: '🟢 Online',
						value: `${online}`,
						inline: true,
					},
					{
						name: '⚫ Offline',
						value: `${offline}`,
						inline: true,
					},
					{
						name: '🟡 Idle',
						value: `${idle}`,
						inline: true,
					},
					{
						name: '🔴 Do Not Disturb',
						value: `${dnd}`,
						inline: true,
					},
					{
						name: `📈 Joined Last ${days} Day${days === 1 ? '' : 's'}`,
						value: `${recentJoins}`,
						inline: true,
					},
					{
						name: '📉 Left (tracking unavailable)',
						value: 'Member leave tracking not available',
						inline: true,
					}
				)
				.setTimestamp()
				.setFooter({ text: 'Member statistics updated' });

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error in membercount command:', error);
			await interaction.editReply(
				'An error occurred while fetching member statistics. Please try again later.'
			);
		}
	},
} as BotCommand;
