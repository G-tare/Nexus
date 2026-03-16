import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBoardConfig, getBoardStats } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('board')
    .setDescription('View quote board statistics and recent entries')
    .addStringOption((option) =>
      option
        .setName('board')
        .setDescription('Board name (optional, defaults to first board)')
        .setRequired(false)
    ),

  module: 'quoteboard',
  permissionPath: 'quoteboard.board',

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

      const stats = await getBoardStats(interaction.guildId!, selectedBoard.id);

      const container = moduleContainer('quote_board');
      addText(container, `### ${selectedBoard.emoji} ${selectedBoard.name} Statistics`);
      addFields(container, [
        {
          name: 'Total Messages',
          value: stats.totalMessages.toString(),
          inline: true,
        },
      ]);

      if (stats.mostStarredMessage) {
        const author = await interaction.client.users.fetch(
          stats.mostStarredMessage.authorId
        );
        addFields(container, [
          {
            name: 'Most Starred Message',
            value: `**${stats.mostStarredMessage.reactionCount}** ${selectedBoard.emoji} from ${author.username}\n[Jump to Message](https://discord.com/channels/${stats.mostStarredMessage.guildId}/${stats.mostStarredMessage.originalChannelId}/${stats.mostStarredMessage.originalMessageId})`,
            inline: false,
          },
        ]);
      }

      if (stats.topAuthors.length > 0) {
        const topAuthorsText = await Promise.all(
          stats.topAuthors.map(async (author) => {
            try {
              const user = await interaction.client.users.fetch(author.authorId);
              return `**${user.username}** - ${author.count} message${author.count !== 1 ? 's' : ''}`;
            } catch {
              return `**Unknown User** - ${author.count} message${author.count !== 1 ? 's' : ''}`;
            }
          })
        );

        addFields(container, [
          {
            name: 'Top Authors',
            value: topAuthorsText.join('\n'),
            inline: false,
          },
        ]);
      }

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in board command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching board statistics.',
      });
    }
  },
} as BotCommand;
