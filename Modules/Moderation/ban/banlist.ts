import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

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

    await interaction.deferReply({});

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

    const container = moduleContainer('moderation');
    addText(container, `### Ban List${search ? ` — "${search}"` : ''}\n${lines.join('\n\n')}`);
    addFooter(container, `Showing ${page.length} of ${filtered.length} bans`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
