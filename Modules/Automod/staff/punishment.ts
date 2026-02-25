import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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

      let responseEmbed: EmbedBuilder;

      switch (subcommand) {
        case 'set': {
          const level = interaction.options.getInteger('level', true);
          const action = interaction.options.getString('action', true) as ActionType;
          const duration = interaction.options.getInteger('duration');

          // Validate mute requires duration
          if (action === 'mute' && !duration) {
            responseEmbed = errorEmbed(
              'Missing Duration',
              'Mute action requires a duration in minutes.'
            );
            await interaction.editReply({ embeds: [responseEmbed] });
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
          responseEmbed = successEmbed(
            `Level ${level} Punishment Updated`,
            `Action: **${action.charAt(0).toUpperCase() + action.slice(1)}**${durationText}`
          );
          break;
        }

        case 'view': {
          const punishments = config.punishments || {};
          const embed = new EmbedBuilder()
            .setColor(Colors.Info)
            .setTitle('Punishment Escalation')
            .setDescription('Current punishments for each offense level');

          for (let level = 1; level <= 5; level++) {
            const punishment = punishments[level as 1 | 2 | 3 | 4 | 5];

            if (punishment) {
              const actionName =
                punishment.type.charAt(0).toUpperCase() +
                punishment.type.slice(1);
              const durationText = (punishment.type === 'mute' && 'duration' in punishment && punishment.duration)
                ? ` - ${punishment.duration / 60} minute${punishment.duration / 60 > 1 ? 's' : ''}`
                : '';
              embed.addFields({
                name: `Level ${level}`,
                value: `${actionName}${durationText}`,
                inline: false,
              });
            } else {
              embed.addFields({
                name: `Level ${level}`,
                value: '*Not configured*',
                inline: false,
              });
            }
          }

          responseEmbed = embed;
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

          responseEmbed = successEmbed(
            'Punishments Reset',
            'Punishment escalation has been reset to default settings.'
          );
          break;
        }

        default:
          responseEmbed = errorEmbed('Invalid Subcommand', 'An error occurred.');
      }

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error in automod-punishment command:', error);
      const embed = errorEmbed(
        'Command Error',
        'An error occurred while processing your request.'
      );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
