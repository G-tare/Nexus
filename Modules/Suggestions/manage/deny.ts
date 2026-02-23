import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getSuggestionConfig, getSuggestionData, updateSuggestionStatus, updateSuggestionMessage } from '../helpers';

const denyCommand: BotCommand = {
  module: 'suggestions',
  permissionPath: 'suggestions.suggestion-deny',
  category: 'engagement',
  data: new SlashCommandBuilder()
    .setName('suggestion-deny')
    .setDescription('Deny a suggestion')
    .addIntegerOption((option) =>
      option.setName('id').setDescription('The suggestion ID to deny').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for denial (required if server has requireReason enabled)')
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
      const reason = interaction.options.getString('reason') || undefined;

      // Get config
      const config = await getSuggestionConfig(interaction.guildId!);

      // Check if reason is required
      if (config.requireReason && !reason) {
        await interaction.reply({
          content: 'This server requires a reason for denying suggestions.',
          ephemeral: true,
        });
        return;
      }

      // Get suggestion data
      const suggestion = await getSuggestionData(interaction.guildId!, suggestionId);
      if (!suggestion) {
        await interaction.reply({
          content: `Suggestion #${suggestionId} not found.`,
          ephemeral: true,
        });
        return;
      }

      // Update status
      await updateSuggestionStatus(interaction.guildId!, suggestionId, 'denied', interaction.user.id, reason);

      // Update message embed
      const updatedSuggestion = await getSuggestionData(interaction.guildId!, suggestionId);
      if (updatedSuggestion) {
        await updateSuggestionMessage(interaction.guild!, updatedSuggestion, config);
      }

      // DM user if enabled
      if (config.dmOnStatusChange) {
        try {
          const user = await interaction.client.users.fetch(suggestion.userId);
          let dmMessage = `Your suggestion #${suggestionId} has been denied.`;
          if (reason) {
            dmMessage += `\n\nReason: ${reason}`;
          }
          await user.send(dmMessage);
        } catch (error) {
          console.error('Failed to DM user about suggestion denial:', error);
        }
      }

      await interaction.reply({
        content: `❌ Suggestion #${suggestionId} has been denied.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error in suggest-deny command:', error);
      await interaction.reply({
        content: 'An error occurred while denying the suggestion.',
        ephemeral: true,
      });
    }
  },
};

export default denyCommand;
