import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  ensureRelationship,
  getPartner,
  createPendingRequest,
  getPendingRequest,
  getFamilyConfig,
} from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addButtons, v2Payload, successReply } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('propose')
    .setDescription('Propose marriage to a user')
    .addUserOption((opt) => opt.setName('user').setDescription('User to propose to').setRequired(true)),

  module: 'family',
  permissionPath: 'family.propose',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getFamilyConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Family module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot propose to yourself.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        content: '❌ You cannot propose to a bot.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await ensureRelationship(interaction.guildId!, interaction.user.id);
    await ensureRelationship(interaction.guildId!, targetUser.id);

    const userPartner = await getPartner(interaction.guildId!, interaction.user.id);
    const targetPartner = await getPartner(interaction.guildId!, targetUser.id);

    if (userPartner) {
      await interaction.reply({
        content: '❌ You are already married.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetPartner) {
      await interaction.reply({
        content: '❌ That user is already married.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = await getPendingRequest(interaction.guildId!, interaction.user.id, targetUser.id, 'marriage');
    if (existing) {
      await interaction.reply({
        content: '❌ You already have a pending proposal to this user.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const expiresAt = new Date(Date.now() + config.proposalExpiry * 1000);

    const request = await createPendingRequest(
      interaction.guildId!,
      interaction.user.id,
      targetUser.id,
      'marriage',
      '',
      '',
      expiresAt
    );

    const container = moduleContainer('family');
    addText(container, '### 💍 Marriage Proposal!\n' + `<@${interaction.user.id}> has proposed to you!`);
    addButtons(container, [
      new ButtonBuilder()
        .setCustomId(`family_accept_${request.id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`family_decline_${request.id}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger),
    ]);

    await interaction.reply({
      content: `<@${targetUser.id}>`,
      ...v2Payload([container]),
    });

    await interaction.followUp({
      ...successReply('💍 Proposal Sent!', `Your proposal has been sent to <@${targetUser.id}>.`),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
