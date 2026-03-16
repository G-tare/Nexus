import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';
import {
  createStatsChannel,
  getStatsChannels,
  getDefaultLabel,
  ALL_STAT_TYPES,
  STAT_TYPE_LABELS,
  STAT_TYPE_EMOJIS,
  StatType,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('statscreate')
    .setDescription('Create a new stats counter channel')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('The statistic to display')
        .setRequired(true)
        .addChoices(
          { name: '👥 Members — Total member count', value: 'members' },
          { name: '🧑 Humans — Non-bot members', value: 'humans' },
          { name: '🤖 Bots — Bot count', value: 'bots' },
          { name: '🏷️ Roles — Total roles', value: 'roles' },
          { name: '💬 Channels — Total channels', value: 'channels' },
          { name: '🚀 Boosts — Boost count', value: 'boosts' },
          { name: '⭐ Boost Level — Server boost tier', value: 'boost_level' },
          { name: '🟢 Online — Online members', value: 'online' },
          { name: '📁 Categories — Category count', value: 'categories' },
          { name: '😀 Emojis — Custom emoji count', value: 'emojis' },
          { name: '🎨 Stickers — Sticker count', value: 'stickers' },
          { name: '📝 Text Channels — Text channel count', value: 'text_channels' },
          { name: '🔊 Voice Channels — Voice channel count', value: 'voice_channels' },
          { name: '🎯 Goal — Progress toward a target', value: 'goal' },
        ))
    .addStringOption(opt =>
      opt.setName('label')
        .setDescription('Custom label template (use {count}, {goal}, {percent}). Leave blank for default.')
        .setMaxLength(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'statschannels',
  permissionPath: 'statschannels.statscreate',
  premiumFeature: 'statschannels.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const statType = interaction.options.getString('type', true) as StatType;
    const customLabel = interaction.options.getString('label');

    // Limit: max 10 stats channels per guild
    const existing = await getStatsChannels(guild.id);
    if (existing.length >= 10) {
      await interaction.reply({
        content: 'You can have a maximum of 10 stats channels. Delete some first.',
      });
      return;
    }

    await interaction.deferReply();

    const entry = await createStatsChannel({
      guild,
      statType,
      labelTemplate: customLabel || undefined,
      createdBy: interaction.user.id,
    });

    if (!entry) {
      await interaction.editReply({ content: 'Failed to create stats channel. Check bot permissions.' });
      return;
    }

    const container = successContainer('📊 Stats Channel Created',
      `${STAT_TYPE_EMOJIS[statType]} Created a **${STAT_TYPE_LABELS[statType]}** counter!\n\n` +
      `**Channel:** <#${entry.channelId}>\n` +
      `**Label:** \`${entry.labelTemplate}\`\n` +
      `**Type:** ${statType}\n\n-# Updates automatically every 5 minutes`
    );

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
