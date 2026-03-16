import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  TextDisplayBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getCountingConfig, getUserCountingLives } from '../helpers';
import {
  moduleContainer,
  addFields,
  addText,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('counting')
  .setDescription('View the current counting count and channel information');

const countingCommand: BotCommand = {
  data: command,
  module: 'counting',
  permissionPath: 'counting.counting',
  premium: false,
  category: 'engagement',
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;

    try {
      const config = await getCountingConfig(guildId);

      if (!config.enabled || !config.channelId) {
        const container = moduleContainer('counting');
        container.setAccentColor(0x808080);
        addText(container, '### Counting Disabled\nCounting is not enabled on this server.');
        const payload = v2Payload([container]);
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }

      const channel = interaction.guild!.channels.cache.get(config.channelId);
      const channelMention = channel ? channel.toString() : 'Unknown Channel';
      const lastCounter = config.lastCounterId
        ? `<@${config.lastCounterId}>`
        : 'No one yet';

      const container = moduleContainer('counting');
      addText(container, '### 📊 Counting Status');
      const fields = [
        { name: 'Current Count', value: String(config.currentCount), inline: true },
        { name: 'Channel', value: channelMention, inline: true },
        { name: 'Last Counter', value: lastCounter, inline: true },
        { name: 'Server Record', value: String(config.highestCount), inline: true },
        { name: 'Current Streak', value: String(config.currentStreak), inline: true },
        { name: 'Highest Streak', value: String(config.highestStreak), inline: true },
        { name: 'Total Successful Counts', value: String(config.totalCounts), inline: true },
        {
          name: 'Your Lives',
          value: String(await getUserCountingLives(guildId, interaction.user.id)),
          inline: true,
        }
      ];
      addFields(container, fields);

      return interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('[Counting] Error in /counting:', error);
      return interaction.reply({
        content: 'An error occurred while fetching counting information.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default countingCommand;
