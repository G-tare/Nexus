import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getConfessionConfig,
  getConfessionData,
} from '../helpers';


const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.owner.reveal',
  data: new SlashCommandBuilder()
    .setName('confession-reveal')
    .setDescription('Reveal the author of a confession (owner only)')
    .addIntegerOption(opt =>
      opt
        .setName('id')
        .setDescription('Confession ID number')
        .setRequired(true)
        .setMinValue(1)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;
    const confessionId = interaction.options.getInteger('id', true);

    // Check if user is server owner
    if (interaction.user.id !== guild.ownerId) {
      await interaction.reply({
        content: 'Only the server owner can use this command.',
        ephemeral: true,
      });
      return;
    }

    try {
      const config = await getConfessionConfig(guildId);

      // Check if full anonymity is enabled
      if (config.fullAnonymity) {
        await interaction.reply({
          content: 'Full anonymity is enabled. No one can see who sent confessions. Disable full anonymity in `/confession-config` to use this command.',
          ephemeral: true,
        });
        return;
      }

      // Get confession data
      const confessionData = await getConfessionData(guildId, confessionId);
      if (!confessionData || !confessionData.userId) {
        await interaction.reply({
          content: `Confession #${confessionId} not found or author information unavailable.`,
          ephemeral: true,
        });
        return;
      }

      // Try to fetch the user
      const user = await interaction.client.users.fetch(confessionData.userId).catch(() => null);
      const userText = user ? `${user.username} (${user.id})` : `User ID: ${confessionData.userId}`;

      await interaction.reply({
        content: `Confession #${confessionId} was sent by: ${userText}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error revealing confession:', error);
      await interaction.reply({
        content: 'An error occurred.',
        ephemeral: true,
      });
    }
  },
};

export default command;
