import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ColorResolvable,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getInviteConfig, InviteConfig } from '../helpers';
import { getDb, getPool, getRedis } from '../../../Shared/src/database/connection';
const db = getDb();
const pool = getPool();
const redis = getRedis();

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.invite-config',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('invite-config')
    .setDescription('Configure invite tracker settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('view').setDescription('View all settings'))
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable invite tracking')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('track-leaves')
        .setDescription('Toggle tracking when invited members leave')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Track leaves?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('track-fakes')
        .setDescription('Toggle detection of fake invites')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Track fakes?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('fake-age')
        .setDescription('Set minimum account age for accounts to not be flagged as fake')
        .addIntegerOption((opt) =>
          opt
            .setName('days')
            .setDescription('Days (default: 7)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(365)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('fake-leave-hours')
        .setDescription('Set hours before leave is flagged as fake')
        .addIntegerOption((opt) =>
          opt
            .setName('hours')
            .setDescription('Hours (default: 24)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(720)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('log-channel')
        .setDescription('Set channel for invite event logs')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel (leave empty to disable)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('announce')
        .setDescription('Configure join announcements')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable announcements?').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to announce in')
            .setRequired(false)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const config = await getInviteConfig(interaction.guildId!);
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === 'view') {
        const embed = new EmbedBuilder()
          .setColor('#5865F2' as ColorResolvable)
          .setTitle('Invite Tracker Configuration')
          .addFields(
            { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            {
              name: 'Track Joins',
              value: config.trackJoins ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Track Leaves',
              value: config.trackLeaves ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Track Fakes',
              value: config.trackFakes ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Fake Account Age (Days)',
              value: config.fakeAccountAgeDays.toString(),
              inline: true,
            },
            {
              name: 'Fake Leave Threshold (Hours)',
              value: config.fakeLeaveHours.toString(),
              inline: true,
            },
            {
              name: 'Log Channel',
              value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set',
              inline: true,
            },
            {
              name: 'Announce Joins',
              value: config.announceJoins ? '✅ Yes' : '❌ No',
              inline: true,
            },
            {
              name: 'Announce Channel',
              value: config.announceChannelId ? `<#${config.announceChannelId}>` : 'Not set',
              inline: true,
            }
          )
          .setFooter({ text: interaction.guild!.name });

        return interaction.editReply({ embeds: [embed] });
      }

      // Update config
      const updates: Partial<InviteConfig> = {};

      if (subcommand === 'toggle') {
        updates.enabled = interaction.options.getBoolean('enabled', true);
      } else if (subcommand === 'track-leaves') {
        updates.trackLeaves = interaction.options.getBoolean('enabled', true);
      } else if (subcommand === 'track-fakes') {
        updates.trackFakes = interaction.options.getBoolean('enabled', true);
      } else if (subcommand === 'fake-age') {
        updates.fakeAccountAgeDays = interaction.options.getInteger('days', true);
      } else if (subcommand === 'fake-leave-hours') {
        updates.fakeLeaveHours = interaction.options.getInteger('hours', true);
      } else if (subcommand === 'log-channel') {
        const channel = interaction.options.getChannel('channel');
        updates.logChannelId = channel?.id;
      } else if (subcommand === 'announce') {
        updates.announceJoins = interaction.options.getBoolean('enabled', true);
        const channel = interaction.options.getChannel('channel');
        if (channel) {
          updates.announceChannelId = channel.id;
        }
      }

      const newConfig = { ...config, ...updates };

      // Update database
      await pool.query(
        `UPDATE guild_settings
         SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{invitetracker}', $1::jsonb)
         WHERE guild_id = $2`,
        [JSON.stringify(newConfig), interaction.guildId!]
      );

      // Clear cache
      await redis.del(`inviteconfig:${interaction.guildId!}`);

      const embed = new EmbedBuilder()
        .setColor('#57F287' as ColorResolvable)
        .setTitle('✅ Configuration Updated')
        .setDescription(`The invite tracker has been configured.`)
        .setFooter({ text: interaction.guild!.name });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /invite-config command:', error);
      return interaction.editReply({
        content: 'An error occurred while updating the configuration.',
      });
    }
  },
};

export default command;
