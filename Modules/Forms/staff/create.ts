import {  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { createForm, FormQuestion } from '../helpers';
import crypto from 'crypto';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formcreate')
    .setDescription('Create a new form')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Form name')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Form description')
        .setRequired(false)
        .setMaxLength(500)
    )
    .addChannelOption((option) =>
      option
        .setName('responsechannel')
        .setDescription('Channel where responses will be sent')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('oneperuser')
        .setDescription('Only allow one submission per user (default: true)')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('dmconfirm')
        .setDescription('DM user confirmation after submission (default: false)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('maxresponses')
        .setDescription('Maximum number of responses (leave blank for unlimited)')
        .setRequired(false)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.create',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.reply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const name = interaction.options.getString('name', true);
      const description = interaction.options.getString('description') || '';
      const responseChannel = interaction.options.getChannel('responsechannel', true);
      const onePerUser = interaction.options.getBoolean('oneperuser') ?? true;
      const dmConfirm = interaction.options.getBoolean('dmconfirm') ?? false;
      const maxResponses = interaction.options.getInteger('maxresponses');

      if (!(responseChannel as any).isTextBased()) {
        await interaction.reply({ content: '❌ Response channel must be a text channel.' });
        return;
      }

      const form = await createForm(
        guildId,
        name,
        description,
        [],
        responseChannel.id,
        onePerUser,
        dmConfirm,
        maxResponses || undefined
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Form Created')
        .setColor('#5865F2')
        .addFields(
          { name: 'Form Name', value: form.name, inline: true },
          { name: 'Form ID', value: form.id, inline: true },
          { name: 'Response Channel', value: `<#${form.responseChannelId}>`, inline: false },
          { name: 'One Per User', value: form.onePerUser ? 'Yes' : 'No', inline: true },
          { name: 'DM Confirmation', value: form.dmConfirm ? 'Yes' : 'No', inline: true },
          { name: 'Status', value: form.isActive ? 'Active' : 'Inactive', inline: true },
          { name: 'Next Step', value: 'Add questions to this form using `/formedit`', inline: false }
        )
        .setTimestamp();

      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`form_edit_${form.id}`)
          .setLabel('Add Questions')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({
        embeds: [embed],
        components: [buttons],
        ephemeral: false,
      });

      logger.info(`[Forms] Form created - ID: ${form.id}, Guild: ${guildId}, Name: ${name}`);
    } catch (error) {
      logger.error('[Forms] /formcreate error:', error);
      await interaction.reply({ content: '❌ An error occurred while creating the form.' });
    }
  },
};

export default command;
