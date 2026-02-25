import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  addColor,
  getColorPalette,
  getColorConfig,
  getColorByName,
  canManageColors,
  DEFAULT_COLORS,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coloradddefaults')
    .setDescription('Add a default set of 16 colors to the palette')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.coloradddefaults',
  premiumFeature: 'colorroles.management',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const config = await getColorConfig(guild.id);
    const existing = await getColorPalette(guild.id);
    const remaining = config.maxColors - existing.length;

    if (remaining <= 0) {
      await interaction.reply({
        content: `The palette is full (${config.maxColors} colors max). Clear some colors first.`,
      });
      return;
    }

    await interaction.deferReply();

    let added = 0;
    let skipped = 0;

    for (const defaultColor of DEFAULT_COLORS) {
      if (added >= remaining) break;

      // Skip if name already exists
      const existingColor = await getColorByName(guild.id, defaultColor.name);
      if (existingColor) {
        skipped++;
        continue;
      }

      try {
        await addColor({
          guild,
          name: defaultColor.name,
          hex: defaultColor.hex,
          createdBy: interaction.user.id,
        });
        added++;
      } catch {
        skipped++;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('🎨 Default Colors Added')
      .setDescription(
        `Added **${added}** default colors to the palette.` +
        (skipped > 0 ? `\nSkipped **${skipped}** (already exist or limit reached).` : '') +
        `\n\nUse \`/colorlist\` to see the full palette.`
      );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
