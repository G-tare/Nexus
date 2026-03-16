import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

type ActionType = 'delete' | 'warn' | 'mute' | 'kick' | 'ban';

interface PunishmentLevel {
  action: ActionType;
  duration?: number; // in seconds for mute
}

const command: BotCommand = {
  module: 'automod',
  permissionPath: 'automod.staff.punishment',
  allowDM: false,
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('automod-punishment')
    .setDescription('Configure escalating punishments for automod violations')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set punishment for a specific offense level')
        .addIntegerOption((opt) =>
          opt
            .setName('level')
            .setDescription('Offense level (1-5)')
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Punishment action')
            .addChoices(
              { name: 'Delete Message', value: 'delete' },
              { name: 'Warn', value: 'warn' },
              { name: 'Mute', value: 'mute' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' }
            )
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Duration in minutes (required for mute)')
            .setMinValue(1)
            .setMaxValue(10080) // 1 week in minutes
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View current punishment escalation settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset punishments to default settings')
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'set': {
          const level = interaction.options.getInteger('level', true);
          const action = interaction.options.getString('action', true) as ActionType;
          const duration = interaction.options.getInteger('duration');

          // Validate mute requires duration
          if (action === 'mute' && !duration) {
            await interaction.editReply(errorReply('Missing Duration', 'Mute action requires a duration in minutes.'));
            return;
          }

          // Update config - ensure punishments object exists
          if (!config.punishments || typeof config.punishments !== 'object') {
            // Initialize with defaults if missing
            config.punishments = {
              1: { type: 'delete' },
              2: { type: 'warn' },
              3: { type: 'mute', duration: 600 },
              4: { type: 'kick' },
              5: { type: 'ban' },
            };
          }

          const durationSeconds = duration ? duration * 60 : undefined;
          config.punishments[level as 1 | 2 | 3 | 4 | 5] = {
            type: action,
            ...(action === 'mute' && durationSeconds ? { duration: durationSeconds } : {}),
          } as any;

          await moduleConfig.setConfig(guildId, 'automod', config);

          const durationText = duration
            ? ` for ${duration} minute${duration > 1 ? 's' : ''}`
            : '';
          await interaction.editReply(successReply(
            `Level ${level} Punishment Updated`,
            `Action: **${action.charAt(0).toUpperCase() + action.slice(1)}**${durationText}`
          ));
          break;
        }

        case 'view': {
          const punishments = config.punishments || {};
          const container = moduleContainer('automod');
          addText(container, '### Punishment Escalation');
          addText(container, 'Current punishments for each offense level');
          addSeparator(container, 'small');

          const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
          for (let level = 1; level <= 5; level++) {
            const punishment = punishments[level as 1 | 2 | 3 | 4 | 5];

            if (punishment) {
              const actionName =
                punishment.type.charAt(0).toUpperCase() +
                punishment.type.slice(1);
              const durationText = (punishment.type === 'mute' && 'duration' in punishment && punishment.duration)
                ? ` - ${punishment.duration / 60} minute${punishment.duration / 60 > 1 ? 's' : ''}`
                : '';
              fields.push({
                name: `Level ${level}`,
                value: `${actionName}${durationText}`,
              });
            } else {
              fields.push({
                name: `Level ${level}`,
                value: '*Not configured*',
              });
            }
          }

          addFields(container, fields);
          await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          break;
        }

        case 'reset': {
          // Reset to default punishments
          config.punishments = {
            1: { type: 'warn' },
            2: { type: 'warn' },
            3: { type: 'mute', duration: 300 }, // 5 minutes
            4: { type: 'kick' },
            5: { type: 'ban' },
          };

          await moduleConfig.setConfig(guildId, 'automod', config);

          await interaction.editReply(successReply(
            'Punishments Reset',
            'Punishment escalation has been reset to default settings.'
          ));
          break;
        }

        default:
          await interaction.editReply(errorReply('Invalid Subcommand', 'An error occurred.'));
      }
    } catch (error) {
      console.error('Error in automod-punishment command:', error);
      await interaction.editReply(errorReply('Command Error', 'An error occurred while processing your request.'));
    }
  },
};

export default command;
