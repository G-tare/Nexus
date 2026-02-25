import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
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
    .setName('poll')
    .setDescription('Create a poll with custom options')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('The poll question')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName('options')
        .setDescription('Comma-separated options (2-10)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Poll duration (e.g., 1h, 30m, 1d). Leave blank for no timer')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('anonymous')
        .setDescription('Hide voter identities (overrides server default)')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('show-live')
        .setDescription('Show results before poll ends (overrides server default)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('max-votes')
        .setDescription('Max votes per user (0=unlimited, default=1)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(10)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to post poll in (default: current channel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    ),

  execute: async (interaction: ChatInputCommandInteraction, deps: any) => {
    const { redis, client } = deps;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Get configuration
      const config = await getPollConfig(interaction.guildId!, redis);

      // Parse inputs
      const question = interaction.options.getString('question', true);
      const optionsStr = interaction.options.getString('options', true);
      const durationStr = interaction.options.getString('duration', false);
      const anonymous = interaction.options.getBoolean('anonymous') ?? config.defaultAnonymous;
      const showLiveResults = interaction.options.getBoolean('show-live') ?? config.defaultShowLiveResults;
      const maxVotes = interaction.options.getInteger('max-votes') ?? config.defaultMaxVotes;
      let targetChannel = interaction.options.getChannel('channel', false) as TextChannel;

      if (!targetChannel) {
        targetChannel = interaction.channel as TextChannel;
      }

      // Validate channel
      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return await interaction.editReply({
          content: '❌ Invalid channel. Please select a valid text channel.',
        });
      }

      // Parse options
      const options = optionsStr
        .split(',')
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);

      if (options.length < 2) {
        return await interaction.editReply({
          content: `❌ Poll must have at least 2 options. You provided ${options.length}.`,
        });
      }

      if (options.length > config.maxOptions) {
        return await interaction.editReply({
          content: `❌ Poll cannot have more than ${config.maxOptions} options. You provided ${options.length}.`,
        });
      }

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

      // Create poll
      const pollId = generatePollId();
      const pollData: PollData = {
        id: pollId,
        guildId: interaction.guildId!,
        channelId: targetChannel.id,
        messageId: '', // Will be set after sending
        creatorId: interaction.user.id,
        question,
        options,
        votes: {},
        anonymous,
        showLiveResults,
        maxVotes,
        endsAt,
        status: 'active',
        createdAt: new Date(),
      };

      // Initialize votes object
      for (let i = 0; i < options.length; i++) {
        pollData.votes[i.toString()] = [];
      }

      // Build embed and components
      const embed = buildPollEmbed(pollData, showLiveResults);
      const components = buildPollComponents(pollData);

      // Send to target channel
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
        content: `✅ Poll created with ID \`${pollId}\`${durationText}.\n[View Poll](https://discord.com/channels/${interaction.guildId!}/${targetChannel.id}/${message.id})`,
      });
    } catch (error) {
      console.error('Error in /poll command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while creating the poll.',
      });
    }
  },

  module: 'polls',
  permissionPath: 'polls.poll',
  premiumFeature: 'polls.basic',
};

export default command;
