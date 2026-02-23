import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ColorResolvable,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { resetInvites } from '../helpers';

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.invite-reset',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('invite-reset')
    .setDescription('Reset invite counts')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('Reset a specific user\'s invite count')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to reset').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('all')
        .setDescription('Reset all invite counts on the server (requires confirmation)')
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'user') {
        const user = interaction.options.getUser('user', true);

        await resetInvites(interaction.guildId!, interaction.user.id, user.id);

        const embed = new EmbedBuilder()
          .setColor('#57F287' as ColorResolvable)
          .setTitle('✅ Invites Reset')
          .setDescription(`Reset all invites for ${user}`)
          .setFooter({ text: interaction.guild!.name });

        return interaction.editReply({ embeds: [embed] });
      } else if (subcommand === 'all') {
        const confirmButton = new ButtonBuilder()
          .setCustomId('invite_reset_all_confirm')
          .setLabel('Confirm Reset All')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId('invite_reset_all_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton
        );

        const embed = new EmbedBuilder()
          .setColor('#ED4245' as ColorResolvable)
          .setTitle('⚠️ Reset All Invites')
          .setDescription(
            'This will reset all invite records for the entire server. This action cannot be undone.'
          )
          .setFooter({ text: interaction.guild!.name });

        await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = interaction.channel!.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        collector.on('collect', async (i) => {
          if (i.customId === 'invite_reset_all_confirm') {
            await i.deferUpdate();
            await resetInvites(interaction.guildId!, interaction.user.id);

            const successEmbed = new EmbedBuilder()
              .setColor('#57F287' as ColorResolvable)
              .setTitle('✅ All Invites Reset')
              .setDescription('Reset all invites for the entire server')
              .setFooter({ text: interaction.guild!.name });

            await interaction.editReply({
              embeds: [successEmbed],
              components: [],
            });
          } else if (i.customId === 'invite_reset_all_cancel') {
            await i.deferUpdate();
            const cancelEmbed = new EmbedBuilder()
              .setColor('#5865F2' as ColorResolvable)
              .setTitle('Cancelled')
              .setDescription('Reset cancelled')
              .setFooter({ text: interaction.guild!.name });

            await interaction.editReply({
              embeds: [cancelEmbed],
              components: [],
            });
          }

          collector.stop();
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
              .setColor('#5865F2' as ColorResolvable)
              .setTitle('Timeout')
              .setDescription('Reset confirmation timed out')
              .setFooter({ text: interaction.guild!.name });

            await interaction.editReply({
              embeds: [timeoutEmbed],
              components: [],
            });
          }
        });
      }
    } catch (error) {
      console.error('Error in /invite-reset command:', error);
      return interaction.editReply({
        content: 'An error occurred while resetting invites.',
      });
    }
  },
};

export default command;
