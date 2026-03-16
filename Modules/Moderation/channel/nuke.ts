import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, warningContainer, successContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
      await interaction.reply(v2Payload([
        errorContainer('Invalid Channel', 'Please specify a valid text channel.')
      ]));
      return;
    }

    // Show confirmation warning
    const warningContainer = new ContainerBuilder();
    warningContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ⚠️ Confirm Channel Nuke\n\nAre you sure you want to nuke <#${targetChannel.id}>?\n\nThis will:\n• Clone the channel with the same name, topic, and permissions\n• Delete the original channel\n• This action cannot be undone\n\n-# You have 30 seconds to confirm.`)
    );

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

    warningContainer.addActionRowComponents(row);

    await interaction.reply(v2Payload([warningContainer]));

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
        await (buttonInteraction as any).update(v2Payload([
          errorContainer('Cancelled', 'Channel nuke has been cancelled.')
        ]));
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
      const successMsgContainer = new ContainerBuilder();
      successMsgContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 💣 Channel Nuked\n\nThis channel has been nuked and recreated.\n\nNuked by: ${interaction.user.tag}\n\n-# The original channel has been deleted.`)
      );

      await newChannel.send({ components: [successMsgContainer], flags: MessageFlags.IsComponentsV2 });

      // Update the original interaction reply
      const confirmContainer = successContainer('Channel Nuked Successfully', `Channel <#${newChannel.id}> has been nuked.`);
      addFields(confirmContainer, [{ name: 'Original Name', value: name || 'Unknown' }]);

      await (buttonInteraction as any).editReply(v2Payload([confirmContainer]));
    } catch {
      // Timeout or no response
      await interaction.editReply(v2Payload([
        errorContainer('Confirmation Timeout', 'Channel nuke has been cancelled due to timeout.')
      ]));
    }
  },
};

export default command;
