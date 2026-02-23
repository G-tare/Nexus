import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('banlist')
    .setDescription('Search the server ban list')
    .addStringOption(opt =>
      opt.setName('search')
        .setDescription('Search by username or reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.banlist',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const search = interaction.options.getString('search')?.toLowerCase();
    const guild = interaction.guild!;

    await interaction.deferReply({ ephemeral: true });

    const bans = await guild.bans.fetch();

    let filtered = [...bans.values()];
    if (search) {
      filtered = filtered.filter(ban =>
        ban.user.username.toLowerCase().includes(search) ||
        ban.user.tag.toLowerCase().includes(search) ||
        ban.reason?.toLowerCase().includes(search) ||
        ban.user.id === search
      );
    }

    if (filtered.length === 0) {
      await interaction.editReply({ content: search ? 'No bans found matching your search.' : 'No bans found.' });
      return;
    }

    // Paginate — show first 20
    const page = filtered.slice(0, 20);
    const lines = page.map(ban =>
      `**${ban.user.tag}** (${ban.user.id})\n> ${ban.reason || 'No reason'}`
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.Moderation)
      .setTitle(`Ban List${search ? ` — "${search}"` : ''}`)
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `Showing ${page.length} of ${filtered.length} bans` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
