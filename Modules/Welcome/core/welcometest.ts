import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	EmbedBuilder,
	AttachmentBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
	getWelcomeConfig,
	buildWelcomeEmbed,
	buildLeaveEmbed,
	buildDmEmbed,
	replacePlaceholders,
	generateWelcomeImage,
} from '../helpers';
import { Colors, infoEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
	data: new SlashCommandBuilder()
		.setName('welcometest')
		.setDescription('Preview welcome/leave/DM messages with yourself as test')
		.addStringOption((option) =>
			option
				.setName('type')
				.setDescription('What type of message to preview')
				.setRequired(true)
				.addChoices(
					{ name: 'Welcome', value: 'welcome' },
					{ name: 'Leave', value: 'leave' },
					{ name: 'DM', value: 'dm' },
					{ name: 'All', value: 'all' }
				)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		,

	module: 'welcome',
	permissionPath: 'welcome.test',
	premiumFeature: 'welcome.basic',

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		try {
			const guild = interaction.guild;
			if (!guild) {
				return await interaction.editReply({
					embeds: [errorEmbed('This command can only be used in a server.')],
				});
			}

			let member: any = interaction.member;
			if (!member) {
				return await interaction.editReply({
					embeds: [errorEmbed('Unable to fetch member information.')],
				});
			}

			// Ensure we have a real GuildMember
			if (!('guild' in member)) {
				try {
					member = await guild.members.fetch(interaction.user.id);
				} catch {
					return await interaction.editReply({
						embeds: [errorEmbed('Unable to fetch member information.')],
					});
				}
			}

			const type = interaction.options.getString('type', true);
			const config = await getWelcomeConfig(guild.id);

			const replies: string[] = [];
			const embeds: EmbedBuilder[] = [];
			const files: AttachmentBuilder[] = [];

			// Welcome message
			if (type === 'welcome' || type === 'all') {
				replies.push('**Welcome Message Preview:**');

				if (!config.welcome.enabled) {
					replies.push('*(Currently disabled)*');
				}

				if ((config.welcome as any).embed.enabled) {
					const welcomeEmbed = buildWelcomeEmbed(member, config.welcome);
					embeds.push(welcomeEmbed);
				}

				if ((config.welcome as any).text) {
					const welcomeText = replacePlaceholders((config.welcome as any).text, member);
					replies.push(`\`\`\`${welcomeText}\`\`\``);
				}

				if ((config.welcome as any).image.enabled) {
					try {
						const attachment = await generateWelcomeImage(member);
						if (attachment) {
							files.push(attachment);
						}
						replies.push('*(Welcome image would be attached)*');
					} catch (error) {
						replies.push('*(Welcome image generation failed)*');
					}
				}

				replies.push('');
			}

			// Leave message
			if (type === 'leave' || type === 'all') {
				replies.push('**Leave Message Preview:**');

				if (!config.leave.enabled) {
					replies.push('*(Currently disabled)*');
				}

				if ((config.leave as any).embed.enabled) {
					const leaveEmbed = buildLeaveEmbed(member, config.leave);
					embeds.push(leaveEmbed);
				}

				if ((config.leave as any).text) {
					const leaveText = replacePlaceholders((config.leave as any).text, member);
					replies.push(`\`\`\`${leaveText}\`\`\``);
				}

				replies.push('');
			}

			// DM message
			if (type === 'dm' || type === 'all') {
				replies.push('**DM Message Preview:**');

				if (!config.dm.enabled) {
					replies.push('*(Currently disabled)*');
				}

				if ((config.dm as any).embed.enabled) {
					const dmEmbed = buildDmEmbed(member, config.dm);
					embeds.push(dmEmbed);
				}

				if ((config.dm as any).text) {
					const dmText = replacePlaceholders((config.dm as any).text, member);
					replies.push(`\`\`\`${dmText}\`\`\``);
				}

				replies.push('*(This message would be sent as a DM, not shown in channel)*');
			}

			const content = replies.join('\n');

			await interaction.editReply({
				content: content || undefined,
				embeds: embeds.length > 0 ? embeds : undefined,
				files: files.length > 0 ? files : undefined,
			});
		} catch (error) {
			console.error('Error in welcometest command:', error);
			await interaction.editReply({
				embeds: [
					errorEmbed(
						'An error occurred while generating the preview. Please check your welcome configuration.'
					),
				],
			});
		}
	},
} as BotCommand;
