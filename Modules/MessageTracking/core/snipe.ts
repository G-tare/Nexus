import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { getLastDeletedMessage } from '../helpers';

const logger = createModuleLogger('MessageTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('View the last deleted message in a channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to snipe from (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  module: 'messagetracking',
  permissionPath: 'messagetracking.snipe',
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

      const deletedMessage = await getLastDeletedMessage(interaction.guild.id, targetChannel.id);

      if (!deletedMessage) {
        await interaction.reply({
          content: `No deleted messages found in <#${targetChannel.id}> within the snipe timeout.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#36393F')
        .setTitle('Sniped Message')
        .setDescription(deletedMessage.content || '*(no text)*')
        .setAuthor({ name: deletedMessage.authorName, iconURL: deletedMessage.authorAvatar })
        .setFooter({ text: `Message was deleted ${new Date(deletedMessage.deletedAt).toLocaleString()}` })
        .setTimestamp(deletedMessage.timestamp);

      if (deletedMessage.embeds && deletedMessage.embeds.length > 0) {
        embed.addFields({ name: 'Embedded Content', value: `${deletedMessage.embeds.length} embed(s)`, inline: false });
      }

      if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
        const attachmentList = deletedMessage.attachments.map((a: any) => `[${a.name}](${a.url})`).join('\n');
        embed.addFields({ name: 'Attachments', value: attachmentList, inline: false });
      }

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (error) {
      logger.error('Error executing snipe command:', error);
      await interaction.reply({ content: '❌ An error occurred while retrieving the sniped message.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
