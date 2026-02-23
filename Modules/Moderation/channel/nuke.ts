import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Clone a channel and delete the original')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to nuke')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.nuke',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
        ephemeral: true,
      });
      return;
    }

    // Show confirmation warning
    const warningEmbed = new EmbedBuilder()
      .setColor(Colors.Warning)
      .setTitle('⚠️ Confirm Channel Nuke')
      .setDescription(`Are you sure you want to nuke <#${targetChannel.id}>?\n\nThis will:\n• Clone the channel with the same name, topic, and permissions\n• Delete the original channel\n• This action cannot be undone`)
      .setFooter({ text: 'You have 30 seconds to confirm.' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('nuke_confirm')
      .setLabel('Confirm Nuke')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('nuke_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(confirmButton, cancelButton);

    await interaction.reply({
      embeds: [warningEmbed],
      components: [row],
      ephemeral: true,
    });

    // Wait for button interaction
    const filter = (i: any) =>
      (i.customId === 'nuke_confirm' || i.customId === 'nuke_cancel') &&
      i.user.id === interaction.user.id;

    try {
      const message = await interaction.fetchReply();
      const buttonInteraction = await message.awaitMessageComponent({
        filter,
        time: 30000,
      });

      if ((buttonInteraction as any).customId === 'nuke_cancel') {
        await (buttonInteraction as any).update({
          embeds: [errorEmbed('Cancelled', 'Channel nuke has been cancelled.')],
          components: [],
        });
        return;
      }

      // Proceed with nuke
      await (buttonInteraction as any).deferUpdate();

      const guild = interaction.guild!;
      const position = (targetChannel as any).position;
      const name = targetChannel.name || 'nuked-channel';
      const topic = (targetChannel as any).topic;
      const permissionOverwrites = (targetChannel as any).permissionOverwrites.cache;
      const isNSFW = (targetChannel as any).nsfw;

      // Clone the channel
      const newChannel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        position,
        topic: topic || undefined,
        nsfw: isNSFW,
        permissionOverwrites: Array.from(permissionOverwrites.values()),
        reason: `Channel nuked by ${interaction.user.tag}`,
      });

      // Delete the original channel
      await (targetChannel as any).delete(`Channel nuked by ${interaction.user.tag}`);

      // Send success message in new channel
      const successEmbed = new EmbedBuilder()
        .setColor(Colors.Warning)
        .setTitle('💣 Channel Nuked')
        .setDescription(`This channel has been nuked and recreated.\n\nNuked by: ${interaction.user.tag}`)
        .setFooter({ text: 'The original channel has been deleted.' });

      await newChannel.send({ embeds: [successEmbed] });

      // Update the original interaction reply
      const confirmEmbed = new EmbedBuilder()
        .setColor(Colors.Warning)
        .setTitle('Channel Nuked Successfully')
        .setDescription(`Channel <#${newChannel.id}> has been nuked.`)
        .addFields({ name: 'Original Name', value: name || 'Unknown' });

      await (buttonInteraction as any).editReply({
        embeds: [confirmEmbed],
        components: [],
      });
    } catch {
      // Timeout or no response
      await interaction.editReply({
        embeds: [errorEmbed('Confirmation Timeout', 'Channel nuke has been cancelled due to timeout.')],
        components: [],
      });
    }
  },
};

export default command;
