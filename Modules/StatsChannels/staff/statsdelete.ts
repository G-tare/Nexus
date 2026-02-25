import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  deleteStatsChannel,
  getStatsChannels,
  STAT_TYPE_LABELS,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('statsdelete')
    .setDescription('Remove a stats counter channel')
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('The stats channel ID (from /statslist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'statschannels',
  permissionPath: 'statschannels.statsdelete',
  premiumFeature: 'statschannels.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const entryId = interaction.options.getInteger('id', true);

    const deleted = await deleteStatsChannel(guild, entryId);
    if (!deleted) {
      await interaction.reply({
        content: `Stats channel with ID \`${entryId}\` not found. Use \`/statslist\` to see active channels.`,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Stats channel \`${entryId}\` deleted.`,
    });
  },
};

export default command;
