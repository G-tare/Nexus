import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  successContainer,
  warningContainer,
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import {
  getQueue,
  getMusicConfig,
  isInSameVoice,
  isInVoiceChannel,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle auto-play for related tracks when queue ends')
    .addBooleanOption((opt) =>
      opt
        .setName('enabled')
        .setDescription('Enable or disable autoplay (optional)')
        .setRequired(false)
    ),

  module: 'music',
  premiumFeature: 'music.advanced',
  permissionPath: 'music.autoplay',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const member = interaction.member as any;
    const config = await getMusicConfig(guildId);
    const queue = getQueue(guildId);

    // Check if user is in voice
    if (!isInVoiceChannel(member)) {
      await interaction.editReply(
        v2Payload([errorContainer('Not in Voice', 'You must be in a voice channel to use this command.')])
      );
      return;
    }

    // Check if queue exists
    if (!queue) {
      await interaction.editReply(
        v2Payload([errorContainer('No Queue', 'There is no active music queue in this server.')])
      );
      return;
    }

    // Check if user is in same voice channel
    if (!isInSameVoice(member, queue)) {
      await interaction.editReply(
        v2Payload([errorContainer('Wrong Voice Channel', 'You must be in the same voice channel as the bot.')])
      );
      return;
    }

    const enabledOption = interaction.options.getBoolean('enabled');

    // Determine new autoplay state
    // We'll store this in the queue object for now; in production, this might be stored in config
    // For now, we'll use a simple boolean property (you may need to add this to GuildQueue interface)
    const currentAutoplay = (queue as any).autoplay ?? config.autoplayEnabled;

    let newAutoplay: boolean;
    if (enabledOption !== null) {
      newAutoplay = enabledOption;
    } else {
      // Toggle current state
      newAutoplay = !currentAutoplay;
    }

    // Store the new autoplay state
    (queue as any).autoplay = newAutoplay;

    const statusEmoji = newAutoplay ? '✅' : '❌';
    const statusText = newAutoplay ? 'enabled' : 'disabled';
    const description = `Autoplay has been **${statusText}**.\n\nWhen the queue ends, ${newAutoplay ? 'related tracks will automatically be queued.' : 'the bot will stop playing.'}`;

    const container = newAutoplay ? successContainer('Autoplay', description) : warningContainer('Autoplay', description);
    addFields(container, [
      {
        name: 'Status',
        value: `${statusEmoji} ${newAutoplay ? 'Enabled' : 'Disabled'}`,
        inline: true,
      },
    ]);

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
