import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  removeColor,
  getMemberColor,
  getColorConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorremove')
    .setDescription('Remove your current color role') as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorremove',
  premiumFeature: 'colorroles.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    // Check if they have a color
    const currentColor = await getMemberColor(guild, interaction.user.id);
    if (!currentColor) {
      await interaction.reply({
        content: 'You don\'t have a color role to remove.',
        ephemeral: true,
      });
      return;
    }

    const removed = await removeColor(guild, interaction.user.id);
    if (!removed) {
      await interaction.reply({
        content: 'Failed to remove your color role.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Your color role **${currentColor.name}** has been removed.`,
      ephemeral: true,
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
