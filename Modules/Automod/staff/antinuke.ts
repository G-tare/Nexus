import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getAutomodConfig, AutomodConfig } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'automod',
  permissionPath: 'automod.staff.antinuke',
  allowDM: false,
  defaultPermissions: PermissionFlagsBits.ManageGuild,
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure nuke protection settings')
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable nuke protection')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Whether to enable nuke protection')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel-limit')
        .setDescription('Set max channel deletions per minute')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Maximum channels that can be deleted per minute')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('role-limit')
        .setDescription('Set max role deletions per minute')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Maximum roles that can be deleted per minute')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban-limit')
        .setDescription('Set max bans per minute')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Maximum bans that can occur per minute')
            .setMinValue(1)
            .setMaxValue(30)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('webhook-limit')
        .setDescription('Set max webhook creates per minute')
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('Maximum webhooks that can be created per minute')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('action')
        .setDescription('Set action to take on nuke detection')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take when nuke is detected')
            .addChoices(
              { name: 'Strip Permissions', value: 'strip' },
              { name: 'Ban User', value: 'ban' },
              { name: 'Kick User', value: 'kick' }
            )
            .setRequired(true)
        )
    ),
  premiumFeature: 'automod.advanced',
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const config = await getAutomodConfig(guildId);
      const subcommand = interaction.options.getSubcommand();

      let updated = false;
      let responseEmbed: EmbedBuilder;

      switch (subcommand) {
        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.antinuke.enabled = enabled;
          updated = true;
          responseEmbed = successEmbed(
            `Nuke Protection ${enabled ? 'Enabled' : 'Disabled'}`,
            `Nuke protection is now **${enabled ? 'enabled' : 'disabled'}**.`
          );
          break;
        }

        case 'channel-limit': {
          const limit = interaction.options.getInteger('limit', true);
          (config.antinuke as any).channelLimit = limit;
          updated = true;
          responseEmbed = successEmbed(
            'Channel Limit Updated',
            `Maximum channels that can be deleted per minute: **${limit}**`
          );
          break;
        }

        case 'role-limit': {
          const limit = interaction.options.getInteger('limit', true);
          (config.antinuke as any).roleLimit = limit;
          updated = true;
          responseEmbed = successEmbed(
            'Role Limit Updated',
            `Maximum roles that can be deleted per minute: **${limit}**`
          );
          break;
        }

        case 'ban-limit': {
          const limit = interaction.options.getInteger('limit', true);
          (config.antinuke as any).banLimit = limit;
          updated = true;
          responseEmbed = successEmbed(
            'Ban Limit Updated',
            `Maximum bans per minute: **${limit}**`
          );
          break;
        }

        case 'webhook-limit': {
          const limit = interaction.options.getInteger('limit', true);
          (config.antinuke as any).webhookLimit = limit;
          updated = true;
          responseEmbed = successEmbed(
            'Webhook Limit Updated',
            `Maximum webhooks created per minute: **${limit}**`
          );
          break;
        }

        case 'action': {
          const action = interaction.options.getString('action', true) as
            | 'strip'
            | 'ban'
            | 'kick';
          config.antinuke.action = action;
          updated = true;
          const actionName =
            action === 'strip'
              ? 'Strip Permissions'
              : action.charAt(0).toUpperCase() + action.slice(1);
          responseEmbed = successEmbed(
            'Nuke Detection Action Updated',
            `Action on detection: **${actionName}**`
          );
          break;
        }

        default:
          responseEmbed = errorEmbed('Invalid Subcommand', 'An error occurred.');
      }

      if (updated) {
        await moduleConfig.setConfig(guildId, 'automod', config);
      }

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      console.error('Error in antinuke command:', error);
      const embed = errorEmbed(
        'Command Error',
        'An error occurred while processing your request.'
      );
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
