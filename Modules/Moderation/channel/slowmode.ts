import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to set slowmode for')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Slowmode duration in seconds (0 to disable)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.slowmode',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const seconds = interaction.options.getInteger('seconds', true);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await (targetChannel as any).setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

      const statusText = seconds === 0
        ? 'Slowmode has been disabled.'
        : `Slowmode has been set to ${seconds} second${seconds !== 1 ? 's' : ''}.`;

      const embed = successEmbed('Slowmode Updated', statusText)
        .addFields(
          { name: 'Channel', value: `<#${targetChannel.id}>`, inline: true },
          { name: 'Duration', value: seconds === 0 ? 'Disabled' : `${seconds}s`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed('Failed', 'Could not set slowmode. Please ensure I have permission to manage this channel.')],
      });
    }
  },
};

export default command;
