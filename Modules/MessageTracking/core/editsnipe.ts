import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
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

      const embed = new EmbedBuilder()
        .setColor('#36393F')
        .setTitle('Edit Sniped Message')
        .setAuthor({ name: editedMessage.authorName, iconURL: editedMessage.authorAvatar })
        .addFields(
          { name: 'Before', value: editedMessage.oldContent || '*(no text)*', inline: false },
          { name: 'After', value: editedMessage.newContent || '*(no text)*', inline: false }
        )
        .setFooter({ text: `Message edited ${new Date(editedMessage.editedAt).toLocaleString()}` })
        .setTimestamp(editedMessage.createdAt);

      if (editedMessage.oldEmbeds && editedMessage.oldEmbeds.length > 0) {
        embed.addFields({ name: 'Old Embedded Content', value: `${editedMessage.oldEmbeds.length} embed(s)`, inline: false });
      }

      if (editedMessage.newEmbeds && editedMessage.newEmbeds.length > 0) {
        embed.addFields({ name: 'New Embedded Content', value: `${editedMessage.newEmbeds.length} embed(s)`, inline: false });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error('Error executing editsnipe command:', error);
      await interaction.reply({ content: '❌ An error occurred while retrieving the edited message.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
