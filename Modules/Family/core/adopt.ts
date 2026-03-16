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
  getParent,
  getChildren,
  createPendingRequest,
  getPendingRequest,
  getFamilyConfig,
  getPartner,
} from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addButtons, v2Payload, successReply } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('adopt')
    .setDescription('Send adoption request to a user')
    .addUserOption((opt) => opt.setName('user').setDescription('User to adopt').setRequired(true)),

  module: 'family',
  permissionPath: 'family.adopt',

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
        content: '❌ You cannot adopt yourself.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        content: '❌ You cannot adopt a bot.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await ensureRelationship(interaction.guildId!, interaction.user.id);
    await ensureRelationship(interaction.guildId!, targetUser.id);

    const targetParent = await getParent(interaction.guildId!, targetUser.id);
    if (targetParent && !config.allowSelfAdopt) {
      await interaction.reply({
        content: '❌ That user already has a parent.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userPartner = await getPartner(interaction.guildId!, interaction.user.id);
    if (userPartner === targetUser.id) {
      await interaction.reply({
        content: '❌ You cannot adopt your partner.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const userParent = await getParent(interaction.guildId!, interaction.user.id);
    if (userParent === targetUser.id) {
      await interaction.reply({
        content: '❌ You cannot adopt your parent.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const children = await getChildren(interaction.guildId!, interaction.user.id);
    if (children.length >= config.maxChildren) {
      await interaction.reply({
        content: `❌ You have reached the max children limit (${config.maxChildren}).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = await getPendingRequest(interaction.guildId!, interaction.user.id, targetUser.id, 'adoption');
    if (existing) {
      await interaction.reply({
        content: '❌ You already have a pending adoption request with this user.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const expiresAt = new Date(Date.now() + config.adoptionExpiry * 1000);

    const request = await createPendingRequest(
      interaction.guildId!,
      interaction.user.id,
      targetUser.id,
      'adoption',
      '',
      '',
      expiresAt
    );

    const container = moduleContainer('family');
    addText(container, '### 👶 Adoption Request!\n' + `<@${interaction.user.id}> wants to adopt you!`);
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
      ...successReply('👶 Adoption Request Sent!', `Your adoption request has been sent to <@${targetUser.id}>.`),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
