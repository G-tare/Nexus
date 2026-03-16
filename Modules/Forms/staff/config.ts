import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { getFormConfig, updateFormConfig } from '../helpers';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('formconfig')
    .setDescription('Configure form module settings')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current form configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable forms module')
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable forms module')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggleapproval')
        .setDescription('Toggle form approval requirement')
    )
    .addSubcommand((sub) =>
      sub
        .setName('setnotificationchannel')
        .setDescription('Set the notification channel for form submissions')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to send notifications to')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  module: 'forms',
  permissionPath: 'forms.config',
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply({ content: '❌ This command can only be used in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await getFormConfig(guildId);

      switch (subcommand) {
        case 'view': {
          const container = moduleContainer('forms');
          addFields(container, [
            { name: 'Module Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Require Approval', value: config.requireApproval ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Notification Channel', value: config.notificationChannelId ? `<#${config.notificationChannelId}>` : 'Not set', inline: false }
          ]);

          await interaction.editReply(v2Payload([container]));
          break;
        }

        case 'enable': {
          await updateFormConfig(guildId, { enabled: true });
          await interaction.editReply({ content: '✅ Forms module enabled.' });
          logger.info(`[Forms] Module enabled for guild: ${guildId}`);
          break;
        }

        case 'disable': {
          await updateFormConfig(guildId, { enabled: false });
          await interaction.editReply({ content: '✅ Forms module disabled.' });
          logger.info(`[Forms] Module disabled for guild: ${guildId}`);
          break;
        }

        case 'toggleapproval': {
          const newValue = !config.requireApproval;
          await updateFormConfig(guildId, { requireApproval: newValue });
          await interaction.editReply({
            content: `✅ Form approval requirement ${newValue ? 'enabled' : 'disabled'}.`,
          });
          logger.info(`[Forms] Approval requirement set to ${newValue} for guild: ${guildId}`);
          break;
        }

        case 'setnotificationchannel': {
          const channel = interaction.options.getChannel('channel', true);
          if (!(channel as any).isTextBased()) {
            await interaction.editReply({ content: '❌ The specified channel must be a text channel.' });
            return;
          }

          await updateFormConfig(guildId, { notificationChannelId: channel.id });
          await interaction.editReply({
            content: `✅ Notification channel set to <#${channel.id}>.`,
          });
          logger.info(`[Forms] Notification channel set to ${channel.id} for guild: ${guildId}`);
          break;
        }

        default:
          await interaction.editReply({ content: '❌ Unknown subcommand.' });
      }
    } catch (error) {
      logger.error('[Forms] /formconfig error:', error);
      await interaction.editReply({ content: '❌ An error occurred while updating configuration.' });
    }
  },
};

export default command;
