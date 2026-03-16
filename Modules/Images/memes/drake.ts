import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getImagesConfig } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('drake')
    .setDescription('Create a Drake meme format')
    .addStringOption((opt) =>
      opt
        .setName('dislike')
        .setDescription('Top text (dislike)')
        .setMaxLength(100)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('like')
        .setDescription('Bottom text (like)')
        .setMaxLength(100)
        .setRequired(true)
    ),

  module: 'images',
  permissionPath: 'images.drake',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getImagesConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Images module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const dislike = interaction.options.getString('dislike', true);
    const like = interaction.options.getString('like', true);

    const container = moduleContainer('images');
    addText(container, `### 🎬 Drake Meme\n\`\`\`
╔═══════════════════════════════════╗
║ ❌ ${dislike.substring(0, 28).padEnd(28)}║
║                                   ║
║ ✅ ${like.substring(0, 28).padEnd(28)}║
╚═══════════════════════════════════╝
\`\`\``);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
