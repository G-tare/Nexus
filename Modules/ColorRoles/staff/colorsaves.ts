import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getSaves,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorsaves')
    .setDescription('View all saved palette backups')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorsaves',
  premiumFeature: 'colorroles.management',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const saves = await getSaves(guild.id);

    if (saves.length === 0) {
      await interaction.reply({
        content: 'No saved palettes. Use `/colorsave` to create a backup.',
      });
      return;
    }

    const lines = saves.map(s => {
      const colorCount = Array.isArray(s.colors) ? s.colors.length : 0;
      const date = new Date(s.createdAt).toLocaleDateString();
      return `**${s.name}** — ${colorCount} colors — ID: \`${s.id}\` — ${date} — <@${s.createdBy}>`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('💾 Saved Palettes')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${saves.length}/20 saves • Use /colorrestore <id> to restore` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
