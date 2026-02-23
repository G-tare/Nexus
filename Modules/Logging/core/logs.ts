import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View recent log entries and logging configuration')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Filter logs by event type (optional)')
        .setRequired(false),
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Filter logs by user (optional)')
        .setRequired(false),
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of recent entries to display (default: 10)')
        .setMinValue(1)
        .setMaxValue(50)
        .setRequired(false),
    ) as SlashCommandBuilder,

  module: 'logging',
  permissionPath: 'logging.logs',
  premiumFeature: 'logging.basic',

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('Logging Configuration Overview')
      .setDescription(
        'Logs are sent to configured channels. Use `/logconfig` to view or modify channel assignments.',
      )
      .addFields(
        {
          name: '📊 How to Use Logs',
          value: [
            '• Logs are automatically sent to designated channels',
            '• Use `/logchannel` to set channels per event type',
            '• Use `/logignore` to exclude channels, roles, or users',
            '• Use `/logtoggle` to enable/disable specific event types',
          ].join('\n'),
        },
        {
          name: '📍 View Configuration',
          value: 'Run `/logconfig` to see all logging setup details',
        },
      )
      .setColor(Colors.Primary);

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
