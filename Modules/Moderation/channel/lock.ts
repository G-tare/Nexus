import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
      await interaction.reply(v2Payload([
        errorContainer('Invalid Channel', 'Please specify a valid text channel.')
      ]));
      return;
    }

    await interaction.deferReply();

    try {
      const everyoneRole = interaction.guild!.roles.everyone;

      // Deny SendMessages permission for @everyone
      await (targetChannel as any).permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
      }, `Channel locked by ${interaction.user.tag}: ${reason}`);

      // Send lock reason container in the channel
      const lockContainer = new ContainerBuilder();
      lockContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### 🔒 Channel Locked\n${reason}`)
      );
      lockContainer.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Locked By:** ${interaction.user.tag}\n**Locked At:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n-# This channel has been locked by a moderator.`)
      );

      await (targetChannel as any).send({ components: [lockContainer], flags: MessageFlags.IsComponentsV2 });

      // Reply to user
      const container = successContainer('Channel Locked', `<#${targetChannel.id}> has been locked.`);
      addFields(container, [{ name: 'Reason', value: reason }]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      await interaction.editReply(v2Payload([
        errorContainer('Failed', 'Could not lock the channel. Please ensure I have permission to manage this channel.')
      ]));
    }
  },
};

export default command;
