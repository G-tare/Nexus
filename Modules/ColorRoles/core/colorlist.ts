import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getColorPalette,
  generatePaletteAttachment,
  getColorConfig,
  hexToInt,
  getColorMemberCount,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorlist')
    .setDescription('View the server\'s color palette') as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorlist',
  premiumFeature: 'colorroles.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({
        content: 'This server doesn\'t have any colors set up yet. Ask a staff member to add some!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    // Generate the palette image
    const attachment = await generatePaletteAttachment(guild.id);

    // Build a text list alongside the image
    const colorLines = colors.map((c, i) =>
      `**${i + 1}.** ${c.name} — \`#${c.hex}\``
    );

    // Split into pages if too many colors
    const maxPerEmbed = 25;
    const description = colorLines.length <= maxPerEmbed
      ? colorLines.join('\n')
      : colorLines.slice(0, maxPerEmbed).join('\n') + `\n*...and ${colorLines.length - maxPerEmbed} more*`;

    const embed = new EmbedBuilder()
      .setColor(hexToInt(colors[0].hex))
      .setTitle(`🎨 ${guild.name} — Color Palette`)
      .setDescription(description)
      .setImage('attachment://color-palette.png')
      .setFooter({ text: `${colors.length} colors available • Use /color <name> to pick one` });

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });

    // Auto-delete if configured
    const config = await getColorConfig(guild.id);
    if (config.deleteResponses) {
      setTimeout(async () => {
        try { await interaction.deleteReply(); } catch { /* expired */ }
      }, config.deleteResponseDelay * 1000);
    }
  },
};

export default command;
