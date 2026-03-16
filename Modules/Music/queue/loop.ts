import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getQueue } from '../helpers';

const LOOP_EMOJIS: Record<string, string> = {
  off: '➡️',
  track: '🔂',
  queue: '🔁',
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode for the queue')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode to set')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track (repeat current)', value: 'track' },
          { name: 'Queue (repeat all)', value: 'queue' }
        )
    ),
  module: 'music',
  permissionPath: 'music.loop',
  premiumFeature: 'music.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply(v2Payload([errorContainer('Server Only', 'This command can only be used in a server.')]));
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.voice.channel) {
      return interaction.reply(v2Payload([errorContainer('Not in Voice', 'You must be in a voice channel.')]));
    }

    const botVoiceChannel = interaction.guild.members.me?.voice.channel;
    if (!botVoiceChannel) {
      return interaction.reply(v2Payload([errorContainer('Bot Not in Voice', 'The bot must be in a voice channel.')]));
    }

    if (member.voice.channel.id !== botVoiceChannel.id) {
      return interaction.reply(v2Payload([errorContainer('Wrong Voice Channel', 'You must be in the same voice channel as the bot.')]));
    }

    const mode = interaction.options.getString('mode', true) as 'off' | 'track' | 'queue';

    const queue = getQueue(interaction.guildId!);
    if (!queue) {
      return interaction.reply(v2Payload([errorContainer('No Queue', 'No active queue in this server.')]));
    }

    queue.loop = mode;

    await interaction.reply(
      v2Payload([
        successContainer(
          'Loop Mode Updated',
          `Loop mode is now set to **${mode}** ${LOOP_EMOJIS[mode]}`
        ),
      ])
    );
  },
};

export default command;
