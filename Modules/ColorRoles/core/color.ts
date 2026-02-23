import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getColorPalette,
  getColorByName,
  assignColor,
  canUseColors,
  getColorConfig,
  hexToInt,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Set your name color from the server palette')
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('The color to set (name or number)')
        .setRequired(true)
        .setAutocomplete(true)
    ) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.color',
  premiumFeature: 'colorroles.basic',
  cooldown: 5,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const colors = await getColorPalette(interaction.guild!.id);

    const filtered = colors
      .filter(c =>
        c.name.toLowerCase().includes(focused) ||
        c.hex.toLowerCase().includes(focused) ||
        String(c.position).includes(focused)
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map(c => ({
        name: `${c.position}. ${c.name} (#${c.hex})`,
        value: c.name,
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const colorInput = interaction.options.getString('color', true);

    // Check channel restriction
    const config = await getColorConfig(guild.id);
    if (config.commandChannelId && interaction.channelId! !== config.commandChannelId) {
      await interaction.reply({
        content: `Color commands can only be used in <#${config.commandChannelId}>.`,
        ephemeral: true,
      });
      return;
    }

    // Check whitelist
    if (!(await canUseColors(guild, interaction.user.id))) {
      await interaction.reply({
        content: 'You don\'t have a whitelisted role to use color commands.',
        ephemeral: true,
      });
      return;
    }

    // Find the color by name or number
    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({
        content: 'This server doesn\'t have any colors set up yet.',
        ephemeral: true,
      });
      return;
    }

    let color = colors.find(c => c.name.toLowerCase() === colorInput.toLowerCase());
    if (!color) {
      // Try by position number
      const num = parseInt(colorInput);
      if (!isNaN(num)) {
        color = colors.find(c => c.position === num);
      }
    }

    if (!color) {
      await interaction.reply({
        content: `Color "${colorInput}" not found. Use \`/colorlist\` to see available colors.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const assigned = await assignColor(guild, interaction.user.id, color.id);
    if (!assigned) {
      await interaction.editReply({ content: 'Failed to assign color. The role may have been deleted.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(hexToInt(color.hex))
      .setDescription(`🎨 Your color has been set to **${color.name}** (\`#${color.hex}\`)`)
      .setFooter({ text: 'Use /colorremove to remove your color' });

    await interaction.editReply({ embeds: [embed] });

    // Auto-delete if configured
    if (config.deleteResponses) {
      setTimeout(async () => {
        try { await interaction.deleteReply(); } catch { /* expired */ }
      }, config.deleteResponseDelay * 1000);
    }
  },
};

export default command;
