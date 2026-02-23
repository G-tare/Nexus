import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBoardConfig, getRandomBoardMessage, buildBoardEmbed } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('random-star')
    .setDescription('Get a random message from the quote board')
    .addStringOption((option) =>
      option
        .setName('board')
        .setDescription('Board name (optional, defaults to first board)')
        .setRequired(false)
    ),

  module: 'quoteboard',
  permissionPath: 'quoteboard.random-star',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    try {
      const config = await getBoardConfig(interaction.guildId!);

      if (!config.enabled || config.boards.length === 0) {
        await interaction.editReply({
          content: 'Quote Board is not enabled on this server.',
        });
        return;
      }

      const boardName = interaction.options.getString('board');
      let selectedBoard = config.boards[0];

      if (boardName) {
        const found = config.boards.find(
          (b) => b.name.toLowerCase() === boardName.toLowerCase()
        );
        if (!found) {
          await interaction.editReply({
            content: `Board "${boardName}" not found. Available boards: ${config.boards.map((b) => b.name).join(', ')}`,
          });
          return;
        }
        selectedBoard = found;
      }

      const boardMessage = await getRandomBoardMessage(
        interaction.guildId!,
        selectedBoard.id
      );

      if (!boardMessage) {
        await interaction.editReply({
          content: `No messages found on the **${selectedBoard.name}** yet!`,
        });
        return;
      }

      // Fetch the original message to get full details
      try {
        const channel = await interaction.guild!.channels.fetch(
          boardMessage.originalChannelId
        );
        if (channel && channel.isTextBased()) {
          const originalMessage = await channel.messages.fetch(
            boardMessage.originalMessageId
          );

          const author = originalMessage.author;
          const embed = buildBoardEmbed(
            originalMessage,
            author,
            selectedBoard,
            boardMessage.reactionCount
          );

          await interaction.editReply({ embeds: [embed] });
        } else {
          throw new Error('Channel not found or not text-based');
        }
      } catch (error) {
        // Fallback if original message was deleted
        const embed = new EmbedBuilder()
          .setAuthor({
            name: boardMessage.authorId,
          })
          .setColor(selectedBoard.color as any)
          .setDescription(boardMessage.content || '*Message content unavailable*')
          .addFields({
            name: 'Reactions',
            value: `${selectedBoard.emoji} ${boardMessage.reactionCount}`,
            inline: true,
          })
          .setTimestamp(boardMessage.createdAt);

        if (boardMessage.attachments.length > 0) {
          embed.setImage(boardMessage.attachments[0]);
        }

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in random-star command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching a random message.',
      });
    }
  },
} as BotCommand;
