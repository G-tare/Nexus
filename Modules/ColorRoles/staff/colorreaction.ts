import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createReactionList,
  getColorPalette,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorreaction')
    .setDescription('Post a color reaction message in a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the reaction color message in')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorreaction',
  premiumFeature: 'colorroles.management',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const colors = await getColorPalette(guild.id);

    if (colors.length === 0) {
      await interaction.reply({
        content: 'No colors in the palette. Add some colors first with `/coloradd` or `/coloradddefaults`.',
      });
      return;
    }

    if (colors.length > 20) {
      await interaction.reply({
        content: `The palette has ${colors.length} colors, but reaction messages support max 20. Only the first 20 will be included. Consider creating multiple reaction messages.`,
        ephemeral: false,
      });
    }

    await interaction.deferReply();

    const list = await createReactionList({
      guild,
      channelId: channel.id,
    });

    if (!list) {
      await interaction.editReply({
        content: 'Failed to create the reaction color message. Make sure I have permissions in that channel.',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setDescription(
        `✅ Reaction color message posted in <#${channel.id}>!\n\n` +
        `Users can react to pick a color. Includes ${Math.min(colors.length, 20)} colors.`
      )
      .setFooter({ text: 'Use /colorreactionlist to see all active reaction messages' });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
