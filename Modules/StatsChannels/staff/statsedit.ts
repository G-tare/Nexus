import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  editStatsChannel,
  getStatsChannels,
  STAT_TYPE_LABELS,
  STAT_TYPE_EMOJIS,
  StatType,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('statsedit')
    .setDescription('Edit a stats channel\'s label or type')
    .addIntegerOption(opt =>
      opt.setName('id')
        .setDescription('The stats channel ID (from /statslist)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('label')
        .setDescription('New label template (use {count}, {goal}, {percent})')
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('New stat type')
        .addChoices(
          { name: '👥 Members', value: 'members' },
          { name: '🧑 Humans', value: 'humans' },
          { name: '🤖 Bots', value: 'bots' },
          { name: '🏷️ Roles', value: 'roles' },
          { name: '💬 Channels', value: 'channels' },
          { name: '🚀 Boosts', value: 'boosts' },
          { name: '⭐ Boost Level', value: 'boost_level' },
          { name: '🟢 Online', value: 'online' },
          { name: '📁 Categories', value: 'categories' },
          { name: '😀 Emojis', value: 'emojis' },
          { name: '🎨 Stickers', value: 'stickers' },
          { name: '📝 Text Channels', value: 'text_channels' },
          { name: '🔊 Voice Channels', value: 'voice_channels' },
          { name: '🎯 Goal', value: 'goal' },
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'statschannels',
  permissionPath: 'statschannels.statsedit',
  premiumFeature: 'statschannels.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const entryId = interaction.options.getInteger('id', true);
    const newLabel = interaction.options.getString('label');
    const newType = interaction.options.getString('type') as StatType | null;

    if (!newLabel && !newType) {
      await interaction.reply({
        content: 'You must provide a new label or type to edit.',
      });
      return;
    }

    await interaction.deferReply();

    const updated = await editStatsChannel({
      guild,
      entryId,
      newLabel: newLabel || undefined,
      newType: newType || undefined,
    });

    if (!updated) {
      await interaction.editReply({
        content: `Stats channel with ID \`${entryId}\` not found.`,
      });
      return;
    }

    const emoji = STAT_TYPE_EMOJIS[updated.statType as keyof typeof STAT_TYPE_EMOJIS] || '📊';
    const typeName = STAT_TYPE_LABELS[updated.statType as keyof typeof STAT_TYPE_LABELS] || updated.statType;

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setDescription(
        `✅ Stats channel updated!\n\n` +
        `${emoji} **Type:** ${typeName}\n` +
        `**Label:** \`${updated.labelTemplate}\`\n` +
        `**Channel:** <#${updated.channelId}>`
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
