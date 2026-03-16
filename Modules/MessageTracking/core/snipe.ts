import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addSeparator, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
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

      const container = moduleContainer('message_tracking');
      addText(container, `### Sniped Message\n**Author:** ${deletedMessage.authorName}\n\n${deletedMessage.content || '*(no text)*'}`);

      if (deletedMessage.embeds && deletedMessage.embeds.length > 0) {
        addText(container, `**Embedded Content:** ${deletedMessage.embeds.length} embed(s)`);
      }

      if (deletedMessage.attachments && deletedMessage.attachments.length > 0) {
        const attachmentList = deletedMessage.attachments.map((a: any) => `[${a.name}](${a.url})`).join('\n');
        addText(container, `**Attachments**\n${attachmentList}`);
      }

      addFooter(container, `Message was deleted ${new Date(deletedMessage.deletedAt).toLocaleString()}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      logger.error('Error executing snipe command:', error);
      await interaction.reply({ content: '❌ An error occurred while retrieving the sniped message.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
