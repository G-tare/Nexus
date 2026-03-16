import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { resetInvites } from '../helpers';
import { moduleContainer, addText, addButtons, v2Payload, successReply, warningContainer } from '../../../Shared/src/utils/componentsV2';

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

        return interaction.editReply(successReply('Invites Reset', `Reset all invites for ${user}`));
      } else if (subcommand === 'all') {
        const confirmButton = new ButtonBuilder()
          .setCustomId('invite_reset_all_confirm')
          .setLabel('Confirm Reset All')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId('invite_reset_all_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary);

        const container = warningContainer('Reset All Invites', 'This will reset all invite records for the entire server. This action cannot be undone.');
        addButtons(container, [confirmButton, cancelButton]);

        await interaction.editReply(v2Payload([container]));

        const collector = interaction.channel!.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000,
          filter: (i) => i.user.id === interaction.user.id,
        });

        collector.on('collect', async (i) => {
          if (i.customId === 'invite_reset_all_confirm') {
            await i.deferUpdate();
            await resetInvites(interaction.guildId!, interaction.user.id);

            await interaction.editReply(successReply('All Invites Reset', 'Reset all invites for the entire server'));
          } else if (i.customId === 'invite_reset_all_cancel') {
            await i.deferUpdate();

            const container = moduleContainer('invite_tracker');
            addText(container, '### Cancelled\nReset cancelled');
            await interaction.editReply(v2Payload([container]));
          }

          collector.stop();
        });

        collector.on('end', async (collected) => {
          if (collected.size === 0) {
            const container = moduleContainer('invite_tracker');
            addText(container, '### Timeout\nReset confirmation timed out');
            await interaction.editReply(v2Payload([container]));
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
