import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  clearAllColors,
  getColorPalette,
  canManageColors,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorclear')
    .setDescription('Clear ALL colors from the palette (irreversible!)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorclear',
  premiumFeature: 'colorroles.management',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.', ephemeral: true });
      return;
    }

    const colors = await getColorPalette(guild.id);
    if (colors.length === 0) {
      await interaction.reply({ content: 'There are no colors to clear.', ephemeral: true });
      return;
    }

    // Confirmation
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('colorclear:confirm')
        .setLabel(`Yes, delete all ${colors.length} colors`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('colorclear:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      content: `⚠️ **Are you sure?** This will delete **${colors.length} color roles** from the palette and Discord. This cannot be undone!\n\nConsider using \`/colorsave\` first to back up your palette.`,
      components: [row],
      fetchReply: true,
    });

    try {
      const buttonInteraction = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      if (buttonInteraction.customId === 'colorclear:confirm') {
        await buttonInteraction.update({
          content: '🗑️ Clearing all colors... This may take a moment.',
          components: [],
        });

        const count = await clearAllColors(guild);

        await interaction.editReply({
          content: `✅ Cleared **${count}** color roles from the palette.`,
          components: [],
        });
      } else {
        await buttonInteraction.update({
          content: '❌ Cancelled.',
          components: [],
        });
      }
    } catch {
      await interaction.editReply({
        content: '⏰ Timed out — no colors were deleted.',
        components: [],
      });
    }
  },
};

export default command;
