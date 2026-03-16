import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getColorPalette,
  assignColor,
  canUseColors,
  getColorConfig,
  hexToInt,
} from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorrandom')
    .setDescription('Get assigned a random color from the server palette') as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorrandom',
  premiumFeature: 'colorroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    // Check channel restriction
    const config = await getColorConfig(guild.id);
    if (config.commandChannelId && interaction.channelId! !== config.commandChannelId) {
      await interaction.reply({
        content: `Color commands can only be used in <#${config.commandChannelId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check whitelist
    if (!(await canUseColors(guild, interaction.user.id))) {
      await interaction.reply({
        content: 'You don\'t have a whitelisted role to use color commands.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({
        content: 'This server doesn\'t have any colors set up yet.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Pick a random color
    const randomIndex = Math.floor(Math.random() * colors.length);
    const color = colors[randomIndex];

    const assigned = await assignColor(guild, interaction.user.id, color.id);
    if (!assigned) {
      await interaction.editReply({ content: 'Failed to assign color. The role may have been deleted.' });
      return;
    }

    const container = moduleContainer('color_roles').setAccentColor(hexToInt(color.hex));
    addText(container, `🎲 You got **${color.name}** (\`#${color.hex}\`)!`);

    await interaction.editReply(v2Payload([container]));

    if (config.deleteResponses) {
      setTimeout(async () => {
        try { await interaction.deleteReply(); } catch { /* expired */ }
      }, config.deleteResponseDelay * 1000);
    }
  },
};

export default command;
