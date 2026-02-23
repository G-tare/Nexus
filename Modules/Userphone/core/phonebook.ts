import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGuildStats, getCallHistory, formatDuration } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('phonebook')
    .setDescription('View your server\'s userphone statistics and recent calls') as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.phonebook',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    const stats = await getGuildStats(guild.id);
    const history = await getCallHistory(guild.id, 5);

    const avgDuration = stats.totalCalls > 0
      ? formatDuration(Math.floor(stats.totalDuration / stats.totalCalls))
      : 'N/A';

    const historyLines = history.length > 0
      ? history.map(h => {
          const other = interaction.client.guilds.cache.get(h.otherGuildId);
          const otherName = other?.name || 'Unknown Server';
          return `• ${otherName} — ${formatDuration(h.duration)} (<t:${Math.floor(h.startedAt / 1000)}:R>)`;
        }).join('\n')
      : 'No calls yet';

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📞 Phonebook')
      .addFields(
        { name: 'Total Calls', value: `${stats.totalCalls}`, inline: true },
        { name: 'Total Messages', value: `${stats.totalMessages}`, inline: true },
        { name: 'Avg Duration', value: avgDuration, inline: true },
        { name: 'Recent Calls', value: historyLines },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
