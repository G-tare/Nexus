import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel by preventing message sending')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to lock')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for locking')
        .setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.lock',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const everyoneRole = interaction.guild!.roles.everyone;

      // Deny SendMessages permission for @everyone
      await (targetChannel as any).permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
      }, `Channel locked by ${interaction.user.tag}: ${reason}`);

      // Send lock reason embed in the channel
      const lockEmbed = new EmbedBuilder()
        .setColor(Colors.Warning)
        .setTitle('🔒 Channel Locked')
        .setDescription(reason)
        .addFields(
          { name: 'Locked By', value: `${interaction.user.tag}`, inline: true },
          { name: 'Locked At', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
        )
        .setFooter({ text: 'This channel has been locked by a moderator.' });

      await (targetChannel as any).send({ embeds: [lockEmbed] });

      // Reply to user
      const embed = successEmbed('Channel Locked', `<#${targetChannel.id}> has been locked.`)
        .addFields({ name: 'Reason', value: reason });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed('Failed', 'Could not lock the channel. Please ensure I have permission to manage this channel.')],
      });
    }
  },
};

export default command;
