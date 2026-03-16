import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import {
  getStatsConfig,
  getStatsChannels,
  ALL_STAT_TYPES,
  STAT_TYPE_LABELS,
  StatType,
  StatsChannelsConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('statsconfig')
    .setDescription('Configure stats channels settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current stats channels configuration'))
    .addSubcommand(sub =>
      sub.setName('interval')
        .setDescription('Set the update interval')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Update interval in seconds (minimum 300 = 5 min)')
            .setRequired(true)
            .setMinValue(300)
            .setMaxValue(3600)))
    .addSubcommand(sub =>
      sub.setName('format')
        .setDescription('Set the number format')
        .addStringOption(opt =>
          opt.setName('style')
            .setDescription('Number formatting style')
            .setRequired(true)
            .addChoices(
              { name: 'Full (1,234)', value: 'full' },
              { name: 'Short (1.2K)', value: 'short' },
            )))
    .addSubcommand(sub =>
      sub.setName('categoryname')
        .setDescription('Set the stats category name')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Category name')
            .setRequired(true)
            .setMaxLength(100)))
    .addSubcommand(sub =>
      sub.setName('goal')
        .setDescription('Configure the goal counter')
        .addIntegerOption(opt =>
          opt.setName('target')
            .setDescription('Goal target number')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(opt =>
          opt.setName('stat')
            .setDescription('Which stat to track for the goal')
            .addChoices(
              { name: 'Members', value: 'members' },
              { name: 'Humans', value: 'humans' },
              { name: 'Boosts', value: 'boosts' },
              { name: 'Roles', value: 'roles' },
              { name: 'Channels', value: 'channels' },
            )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'statschannels',
  permissionPath: 'statschannels.statsconfig',
  premiumFeature: 'statschannels.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();
    const config = await getStatsConfig(guild.id);

    switch (sub) {
      case 'view': {
        const channels = await getStatsChannels(guild.id);
        const goalStat = STAT_TYPE_LABELS[config.goalStatType as keyof typeof STAT_TYPE_LABELS] || config.goalStatType;

        const container = moduleContainer('stats_channels');
        addFields(container, [
          { name: 'Active Channels', value: `${channels.length}/10`, inline: true },
          { name: 'Update Interval', value: `${config.updateInterval}s (${Math.round(config.updateInterval / 60)} min)`, inline: true },
          { name: 'Number Format', value: config.numberFormat === 'full' ? 'Full (1,234)' : 'Short (1.2K)', inline: true },
          { name: 'Category Name', value: config.categoryName, inline: true },
          { name: 'Goal Target', value: `${config.goalTarget.toLocaleString()}`, inline: true },
          { name: 'Goal Stat', value: goalStat, inline: true },
        ]);

        await interaction.reply(v2Payload([container]));
        break;
      }

      case 'interval': {
        const seconds = interaction.options.getInteger('seconds', true);
        await moduleConfig.setConfig(guild.id, 'statschannels', { ...config, updateInterval: seconds });
        await interaction.reply({
          content: `✅ Update interval set to **${seconds} seconds** (${Math.round(seconds / 60)} minutes). Takes effect on next cycle.`,
        });
        break;
      }

      case 'format': {
        const style = interaction.options.getString('style', true) as 'full' | 'short';
        await moduleConfig.setConfig(guild.id, 'statschannels', { ...config, numberFormat: style });
        await interaction.reply({
          content: `✅ Number format set to **${style === 'full' ? 'Full (1,234)' : 'Short (1.2K)'}**.`,
        });
        break;
      }

      case 'categoryname': {
        const name = interaction.options.getString('name', true).trim();
        await moduleConfig.setConfig(guild.id, 'statschannels', { ...config, categoryName: name });
        await interaction.reply({
          content: `✅ Category name set to **${name}**. New stats channels will use this name. Existing category is not renamed — delete and recreate to apply.`,
        });
        break;
      }

      case 'goal': {
        const target = interaction.options.getInteger('target', true);
        const stat = interaction.options.getString('stat') as StatType || config.goalStatType;
        await moduleConfig.setConfig(guild.id, 'statschannels', { ...config, goalTarget: target, goalStatType: stat });

        const statName = STAT_TYPE_LABELS[stat as keyof typeof STAT_TYPE_LABELS] || stat;
        await interaction.reply({
          content: `✅ Goal set to **${target.toLocaleString()} ${statName}**.`,
        });
        break;
      }
    }
  },
};

export default command;
