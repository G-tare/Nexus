import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  addBonusInvites,
  removeBonusInvites,
  getInviterStats,
} from '../helpers';
import { moduleContainer, addFields, v2Payload, successContainer, infoContainer } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.invite-bonus',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('invite-bonus')
    .setDescription('Manage bonus invites for users')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add bonus invites to a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to add bonus to').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of invites to add')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove bonus invites from a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to remove bonus from').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of invites to remove')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View bonus invites for a user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to check').setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);

    try {
      if (subcommand === 'add') {
        const amount = interaction.options.getInteger('amount', true);

        await addBonusInvites(interaction.guildId!, user.id, amount, interaction.user.id);

        const stats = await getInviterStats(interaction.guildId!, user.id);

        const container = successContainer('Bonus Invites Added', `Added ${amount} bonus invites to ${user}`);
        addFields(container, [
          { name: 'Bonus Invites', value: stats.bonus.toString(), inline: true },
          { name: 'Total Real Invites', value: stats.real.toString(), inline: true }
        ]);

        return interaction.editReply(v2Payload([container]));
      } else if (subcommand === 'remove') {
        const amount = interaction.options.getInteger('amount', true);

        await removeBonusInvites(interaction.guildId!, user.id, amount, interaction.user.id);

        const stats = await getInviterStats(interaction.guildId!, user.id);

        const container = successContainer('Bonus Invites Removed', `Removed ${amount} bonus invites from ${user}`);
        addFields(container, [
          { name: 'Bonus Invites', value: stats.bonus.toString(), inline: true },
          { name: 'Total Real Invites', value: stats.real.toString(), inline: true }
        ]);

        return interaction.editReply(v2Payload([container]));
      } else if (subcommand === 'view') {
        const stats = await getInviterStats(interaction.guildId!, user.id);

        const container = infoContainer(`Bonus Invites for ${user.tag}`);
        addFields(container, [
          { name: 'Bonus Invites', value: stats.bonus.toString(), inline: true },
          { name: 'Real Invites', value: stats.real.toString(), inline: true },
          { name: 'Total (with bonus)', value: stats.real.toString(), inline: true }
        ]);

        return interaction.editReply(v2Payload([container]));
      }
    } catch (error) {
      console.error('Error in /invite-bonus command:', error);
      return interaction.editReply({
        content: 'An error occurred while managing bonus invites.',
      });
    }
  },
};

export default command;
