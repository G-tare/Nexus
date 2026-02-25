import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getReactionLists,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorreactionlist')
    .setDescription('View all active reaction color messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorreactionlist',
  premiumFeature: 'colorroles.management',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const lists = await getReactionLists(guild.id);

    if (lists.length === 0) {
      await interaction.reply({
        content: 'No active reaction color messages. Use `/colorreaction` to create one.',
      });
      return;
    }

    const lines = lists.map((l, i) =>
      `**${i + 1}.** <#${l.channelId}> — ${l.colorIds.length} colors — ID: \`${l.id}\` — [Jump](https://discord.com/channels/${guild.id}/${l.channelId}/${l.messageId})`
    );

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🎨 Reaction Color Messages')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Use /colorreactiondelete <id> to remove one' });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
