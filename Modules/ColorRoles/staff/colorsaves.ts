import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getSaves,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

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

    const container = moduleContainer('color_roles').setAccentColor(0x3498DB);
    addText(container, `### 💾 Saved Palettes`);
    addText(container, lines.join('\n'));
    addFooter(container, `${saves.length}/20 saves • Use /colorrestore <id> to restore`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
