import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, errorContainer } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('minecraft')
    .setDescription('Check Minecraft server status')
    .addStringOption((opt) =>
      opt
        .setName('server')
        .setDescription('Server address (e.g., play.example.com)')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.minecraft',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const server = interaction.options.getString('server', true);

      // Fetch from mcsrvstat API
      const response = await fetch(
        `https://api.mcsrvstat.us/3/${encodeURIComponent(server)}`
      );

      if (!response.ok) {
        throw new Error('Minecraft API request failed');
      }

      const data = (await response.json()) as any;

      if (!data.online) {
        await interaction.editReply(v2Payload([errorContainer('Minecraft Server Offline', `**${server}** is currently **offline**`)]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, `### 🎮 Minecraft Server Status\n**${server}** is **online** ✅`);
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Players',
          value: `${data.players?.online || 0}/${data.players?.max || 'Unknown'}`,
          inline: true,
        },
        {
          name: 'Version',
          value: data.version || 'Unknown',
          inline: true,
        },
        {
          name: 'MOTD',
          value: data.motd?.html?.join('\n') || 'No MOTD',
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in minecraft command:', error);
      await interaction.editReply({
        content: 'An error occurred while checking the server status.',
      });
    }
  },
};

export default command;
