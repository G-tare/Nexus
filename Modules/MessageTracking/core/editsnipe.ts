import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getLastEditedMessage } from '../helpers';

const logger = createModuleLogger('MessageTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('View the last edited message in a channel (before and after)')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to editsnipe from (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  module: 'messagetracking',
  permissionPath: 'messagetracking.editsnipe',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
      }

      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (!targetChannel || !(targetChannel as any).isTextBased()) {
        await interaction.reply({ content: 'Invalid channel specified.', flags: MessageFlags.Ephemeral });
        return;
      }

      const editedMessage = await getLastEditedMessage(interaction.guild.id, targetChannel.id);

      if (!editedMessage) {
        await interaction.reply({
          content: `No edited messages found in <#${targetChannel.id}> within the snipe timeout.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const container = moduleContainer('message_tracking');
      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Author', value: editedMessage.authorName, inline: false },
        { name: 'Before', value: editedMessage.oldContent || '*(no text)*', inline: false },
        { name: 'After', value: editedMessage.newContent || '*(no text)*', inline: false }
      ];

      if (editedMessage.oldEmbeds && editedMessage.oldEmbeds.length > 0) {
        fields.push({ name: 'Old Embedded Content', value: `${editedMessage.oldEmbeds.length} embed(s)`, inline: false });
      }

      if (editedMessage.newEmbeds && editedMessage.newEmbeds.length > 0) {
        fields.push({ name: 'New Embedded Content', value: `${editedMessage.newEmbeds.length} embed(s)`, inline: false });
      }

      addFields(container, fields);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      logger.error('Error executing editsnipe command:', error);
      await interaction.reply({ content: '❌ An error occurred while retrieving the edited message.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
