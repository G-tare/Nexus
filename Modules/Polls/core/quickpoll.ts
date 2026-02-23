import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  PollData,
  getPollConfig,
  createPoll,
  buildPollEmbed,
  buildPollComponents,
  generatePollId,
  parseDuration,
  storePollMessage,
} from '../helpers';


const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('quickpoll')
    .setDescription('Create a quick yes/no poll')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('The poll question')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Poll duration (e.g., 1h, 30m, 1d). Leave blank for no timer')
        .setRequired(false)
    ),

  execute: async (interaction: ChatInputCommandInteraction, deps: any) => {
    const { redis, client } = deps;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get configuration
      const config = await getPollConfig(interaction.guildId!, redis);

      // Parse inputs
      const question = interaction.options.getString('question', true);
      const durationStr = interaction.options.getString('duration', false);

      // Parse duration
      let endsAt: Date | undefined;
      if (durationStr) {
        const durationMs = parseDuration(durationStr);
        if (!durationMs) {
          return await interaction.editReply({
            content: '❌ Invalid duration format. Use: 30s, 5m, 1h, 1d',
          });
        }

        const durationHours = durationMs / (60 * 60 * 1000);
        if (durationHours > config.maxDuration) {
          return await interaction.editReply({
            content: `❌ Duration cannot exceed ${config.maxDuration} hours.`,
          });
        }

        endsAt = new Date(Date.now() + durationMs);
      }

      // Create poll with Yes/No options
      const pollId = generatePollId();
      const options = ['Yes', 'No'];

      const pollData: PollData = {
        id: pollId,
        guildId: interaction.guildId!,
        channelId: interaction.channelId!,
        messageId: '', // Will be set after sending
        creatorId: interaction.user.id,
        question,
        options,
        votes: {},
        anonymous: config.defaultAnonymous,
        showLiveResults: config.defaultShowLiveResults,
        maxVotes: 1, // One vote per user for quick poll
        endsAt,
        status: 'active',
        createdAt: new Date(),
      };

      // Initialize votes object
      for (let i = 0; i < options.length; i++) {
        pollData.votes[i.toString()] = [];
      }

      // Build embed and components
      const embed = buildPollEmbed(pollData, config.defaultShowLiveResults);
      const components = buildPollComponents(pollData);

      // Send to current channel
      const targetChannel = interaction.channel as TextChannel;
      const message = await (targetChannel as any).send({
        embeds: [embed],
        components,
      });

      // Store message ID and save poll
      pollData.messageId = message.id;
      await createPoll(pollData, redis);
      await storePollMessage(message.id, pollId, redis);

      // Reply to user
      const durationText = endsAt ? ` and ends <t:${Math.floor(endsAt.getTime() / 1000)}:R>` : '';
      await interaction.editReply({
        content: `✅ Quick poll created with ID \`${pollId}\`${durationText}.\n[View Poll](https://discord.com/channels/${interaction.guildId!}/${targetChannel.id}/${message.id})`,
      });
    } catch (error) {
      console.error('Error in /quickpoll command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while creating the quick poll.',
      });
    }
  },

  module: 'polls',
  permissionPath: 'polls.quickpoll',
  premiumFeature: 'polls.basic',
};

export default command;
