import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getSuggestionConfig,
  getSuggestionData,
  deleteSuggestion,
} from '../helpers';

const removeCommand: BotCommand = {
  module: 'suggestions',
  permissionPath: 'suggestions.suggestion-remove',
  category: 'engagement',
  data: new SlashCommandBuilder()
    .setName('suggestion-remove')
    .setDescription('Delete a suggestion (bad/useless)')
    .addIntegerOption((option) =>
      option.setName('id').setDescription('The suggestion ID to remove').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Optional reason for removal')
        .setRequired(false)
        .setMaxLength(1000),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Check permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
          content: 'You need `Manage Guild` permission to use this command.',
          ephemeral: true,
        });
        return;
      }

      const suggestionId = interaction.options.getInteger('id', true);
      const reason = interaction.options.getString('reason');

      // Get config
      const config = await getSuggestionConfig(interaction.guildId!);

      // Get suggestion data
      const suggestion = await getSuggestionData(interaction.guildId!, suggestionId);
      if (!suggestion) {
        await interaction.reply({
          content: `Suggestion #${suggestionId} not found.`,
          ephemeral: true,
        });
        return;
      }

      // Delete the suggestion message from the channel
      if (config.channelId) {
        try {
          const channel = (await interaction.guild!.channels.fetch(config.channelId)) as TextChannel;
          if (channel) {
            const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
            if (message) {
              await message.delete();
            }
          }
        } catch (error) {
          console.error('Failed to delete suggestion message:', error);
        }
      }

      // Delete the thread if one was created
      if (suggestion.threadId) {
        try {
          const thread = await interaction.guild!.channels.fetch(suggestion.threadId).catch(() => null);
          if (thread) {
            await thread.delete();
          }
        } catch (error) {
          console.error('Failed to delete suggestion thread:', error);
        }
      }

      // Remove from storage
      await deleteSuggestion(interaction.guildId!, suggestionId);

      // DM user that suggestion was removed
      try {
        const user = await interaction.client.users.fetch(suggestion.userId);
        let dmMessage = `Your suggestion #${suggestionId} has been removed.`;
        if (reason) {
          dmMessage += `\n\nReason: ${reason}`;
        }
        await user.send(dmMessage);
      } catch (error) {
        console.error('Failed to DM user about suggestion removal:', error);
      }

      // Log the removal
      console.log(`Suggestion #${suggestionId} removed by ${interaction.user.tag}${reason ? ` with reason: ${reason}` : ''}`);

      await interaction.reply({
        content: `🗑️ Suggestion #${suggestionId} has been removed.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error in suggest-remove command:', error);
      await interaction.reply({
        content: 'An error occurred while removing the suggestion.',
        ephemeral: true,
      });
    }
  },
};

export default removeCommand;
