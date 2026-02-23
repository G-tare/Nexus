import {
  SlashCommandBuilder, ChannelType, TextChannel, EmbedBuilder,
  ButtonBuilder, ActionRowBuilder, ButtonStyle, ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { createGiveaway, getActiveGiveaways, getGiveawayConfig, buildGiveawayEmbed, buildGiveawayComponents } from '../helpers';
import { Colors } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a new giveaway')
    .addStringOption((option) => option.setName('prize').setDescription('The prize for the giveaway').setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName('duration').setDescription('How long the giveaway lasts (e.g., 1h, 2d, 30m)').setRequired(true))
    .addIntegerOption((option) => option.setName('winners').setDescription('Number of winners (default: 1)').setMinValue(1).setMaxValue(20))
    .addChannelOption((option) => option.setName('channel').setDescription('Channel to send giveaway to').addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName('description').setDescription('Additional description').setMaxLength(1000)),

  module: 'giveaways',
  permissionPath: 'giveaways.giveaway',
  premiumFeature: 'giveaways.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const winnerCount = interaction.options.getInteger('winners') ?? 1;
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel;
    const description = interaction.options.getString('description');

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({ content: 'Invalid duration format. Use formats like: 1h, 2d, 30m', ephemeral: true });
    }

    const endTime = new Date(Date.now() + durationMs);

    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      return interaction.reply({ content: 'Target channel must be a text channel.', ephemeral: true });
    }

    const activeGiveaways = await getActiveGiveaways(interaction.guild.id);
    if (activeGiveaways.length >= 10) {
      return interaction.reply({ content: 'Maximum of 10 active giveaways reached. End or cancel some first.', ephemeral: true });
    }

    try {
      const giveaway = await createGiveaway({
        guildId: interaction.guild.id,
        channelId: targetChannel.id,
        hostId: interaction.user.id,
        prize,
        winnerCount,
        endsAt: endTime,
      });

      const embed = new EmbedBuilder()
        .setColor(Colors.Primary)
        .setTitle(`🎉 ${prize}`)
        .setDescription(
          `**Winners:** ${winnerCount}\n${description ? `**Description:** ${description}\n` : ''}**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`
        )
        .addFields(
          { name: 'Entries', value: '0', inline: true },
          { name: 'Status', value: 'Active', inline: true },
          { name: 'Giveaway ID', value: String(giveaway.id), inline: true }
        )
        .setTimestamp();

      const enterButton = new ButtonBuilder()
        .setCustomId(`giveaway_enter_${giveaway.id}`)
        .setLabel('🎁 Enter Giveaway')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton);
      const message = await (targetChannel as any).send({ embeds: [embed], components: [row] });

      const config = await getGiveawayConfig(interaction.guild.id);
      if ((config as any).pingRoleId) {
        const role = await interaction.guild.roles.fetch((config as any).pingRoleId);
        if (role) {
          await (targetChannel as any).send({
            content: `${role} A new giveaway has started!`,
            allowedMentions: { roles: [(config as any).pingRoleId] },
          });
        }
      }

      return interaction.reply({ content: `✅ Giveaway created! [View here](${message.url})`, ephemeral: true });
    } catch (error) {
      console.error('Error creating giveaway:', error);
      return interaction.reply({ content: 'An error occurred while creating the giveaway.', ephemeral: true });
    }
  },
} as BotCommand;
