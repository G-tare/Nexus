import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import {
  getReactionRolesConfig,
  saveReactionRolesConfig,
  getPanelById,
  deletePanel,
} from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-remove')
    .setDescription('Delete a reaction role panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(option =>
      option
        .setName('panel-id')
        .setDescription('Panel ID to delete')
        .setRequired(true),
    ),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-remove',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    const panelId = interaction.options.getString('panel-id')!;
    const config = await getReactionRolesConfig(interaction.guildId!);
    const panel = getPanelById(config, panelId);

    if (!panel) {
      return interaction.reply({
        content: '❌ Panel not found.',
      });
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId('rr_delete_confirm')
      .setLabel('Delete Panel')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('rr_delete_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ Delete Reaction Role Panel')
      .setDescription(`Are you sure you want to delete panel \`${panelId}\`?\n\nThis action cannot be undone.`);

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
    });

    try {
      const buttonInteraction = await reply.awaitMessageComponent({
        time: 60000,
      });

      if (buttonInteraction.customId === 'rr_delete_confirm') {
        await deletePanel(interaction.guild, panel);

        const panelIndex = config.panels.findIndex(p => p.id === panelId);
        if (panelIndex !== -1) {
          config.panels.splice(panelIndex, 1);
          await saveReactionRolesConfig(interaction.guildId!, config);
        }

        await buttonInteraction.update({
          content: '✅ Panel deleted successfully.',
          embeds: [],
          components: [],
        });
      } else {
        await buttonInteraction.update({
          content: '❌ Deletion cancelled.',
          embeds: [],
          components: [],
        });
      }
    } catch (error) {
      if ((error as any).code === 'InteractionCollectorError') {
        await interaction.editReply({
          content: '❌ Confirmation timed out.',
          components: [],
        });
      } else {
        console.error('Error deleting panel:', error);
        await interaction.editReply({
          content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
          components: [],
        });
      }
    }
  },
};

export default BotCommand;
