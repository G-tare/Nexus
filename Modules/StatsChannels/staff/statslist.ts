import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import {
  getStatsChannels,
  STAT_TYPE_LABELS,
  STAT_TYPE_EMOJIS,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('statslist')
    .setDescription('View all active stats counter channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'statschannels',
  permissionPath: 'statschannels.statslist',
  premiumFeature: 'statschannels.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channels = await getStatsChannels(guild.id);

    if (channels.length === 0) {
      await interaction.reply({
        content: 'No stats channels set up. Use `/statscreate` to create one.',
      });
      return;
    }

    const lines = channels.map(c => {
      const emoji = STAT_TYPE_EMOJIS[c.statType as keyof typeof STAT_TYPE_EMOJIS] || '📊';
      const typeName = STAT_TYPE_LABELS[c.statType as keyof typeof STAT_TYPE_LABELS] || c.statType;
      return `${emoji} **${typeName}** — <#${c.channelId}> — ID: \`${c.id}\`\n   Label: \`${c.labelTemplate}\``;
    });

    const container = moduleContainer('stats_channels');
    addText(container, `### 📊 Stats Channels\n${lines.join('\n\n')}`);
    addFooter(container, `${channels.length}/10 stats channels • Use /statsdelete <id> to remove`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
