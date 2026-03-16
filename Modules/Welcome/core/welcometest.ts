import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	AttachmentBuilder, MessageFlags, ContainerBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
	getWelcomeConfig,
	buildWelcomeContainer,
	buildLeaveContainer,
	buildDmContainer,
	replacePlaceholders,
	generateWelcomeImage,
} from '../helpers';
import { errorReply, v2Payload, moduleContainer, addText } from '../../../Shared/src/utils/componentsV2';

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
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const guild = interaction.guild;
			if (!guild) {
				return await interaction.editReply(
					errorReply('Error', 'This command can only be used in a server.')
				);
			}

			let member: any = interaction.member;
			if (!member) {
				return await interaction.editReply(
					errorReply('Error', 'Unable to fetch member information.')
				);
			}

			// Ensure we have a real GuildMember
			if (!('guild' in member)) {
				try {
					member = await guild.members.fetch(interaction.user.id);
				} catch {
					return await interaction.editReply(
						errorReply('Error', 'Unable to fetch member information.')
					);
				}
			}

			const type = interaction.options.getString('type', true);
			const config = await getWelcomeConfig(guild.id);

			const containers: ContainerBuilder[] = [];
			const files: AttachmentBuilder[] = [];

			// Welcome message
			if (type === 'welcome' || type === 'all') {
				if (config.welcome.enabled) {
					if (config.welcome.useEmbed) {
						const welcomeContainer = buildWelcomeContainer(member, config.welcome);
						containers.push(welcomeContainer);
					} else {
						const container = moduleContainer('welcome');
						const welcomeText = replacePlaceholders(config.welcome.message, member);
						addText(container, welcomeText);
						containers.push(container);
					}

					if (config.welcome.showImage) {
						try {
							const attachment = await generateWelcomeImage(member);
							if (attachment) {
								files.push(attachment);
							}
						} catch (error) {
							// Silently fail on image generation
						}
					}
				} else {
					const container = moduleContainer('welcome');
					addText(container, '**Welcome Message Preview:**\n*(Currently disabled)*');
					containers.push(container);
				}
			}

			// Leave message
			if (type === 'leave' || type === 'all') {
				if (config.leave.enabled) {
					if (config.leave.useEmbed) {
						const leaveContainer = buildLeaveContainer(member, config.leave);
						containers.push(leaveContainer);
					} else {
						const container = moduleContainer('welcome');
						const leaveText = replacePlaceholders(config.leave.message, member);
						addText(container, leaveText);
						containers.push(container);
					}
				} else {
					const container = moduleContainer('welcome');
					addText(container, '**Leave Message Preview:**\n*(Currently disabled)*');
					containers.push(container);
				}
			}

			// DM message
			if (type === 'dm' || type === 'all') {
				if (config.dm.enabled) {
					if (config.dm.useEmbed) {
						const dmContainer = buildDmContainer(member, config.dm);
						containers.push(dmContainer);
					} else {
						const container = moduleContainer('welcome');
						const dmText = replacePlaceholders(config.dm.message, member);
						addText(container, dmText);
						containers.push(container);
					}
					const container = moduleContainer('welcome');
					addText(container, '*(This message would be sent as a DM, not shown in channel)*');
					containers.push(container);
				} else {
					const container = moduleContainer('welcome');
					addText(container, '**DM Message Preview:**\n*(Currently disabled)*');
					containers.push(container);
				}
			}

			await interaction.editReply(v2Payload(containers, files.length > 0 ? files : undefined));
		} catch (error) {
			console.error('Error in welcometest command:', error);
			await interaction.editReply(
				errorReply(
					'Error',
					'An error occurred while generating the preview. Please check your welcome configuration.'
				)
			);
		}
	},
} as BotCommand;
