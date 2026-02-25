import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getLevelingConfig, LevelingConfig } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.config',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('levelconfig')
    .setDescription('Configure leveling settings for this server')
    .addSubcommand(sub =>
      sub
        .setName('xp-range')
        .setDescription('Set the XP range per message')
        .addIntegerOption(option =>
          option
            .setName('min')
            .setDescription('Minimum XP per message')
            .setMinValue(0)
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('max')
            .setDescription('Maximum XP per message')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('cooldown')
        .setDescription('Set the XP cooldown in seconds')
        .addIntegerOption(option =>
          option
            .setName('seconds')
            .setDescription('Cooldown in seconds')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('voice-xp')
        .setDescription('Set the XP earned per minute in voice')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('XP per minute')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('announce')
        .setDescription('Set the level-up announcement type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Announcement type')
            .addChoices(
              { name: 'Current Channel', value: 'current' },
              { name: 'Specific Channel', value: 'channel' },
              { name: 'Direct Message', value: 'dm' },
              { name: 'Off', value: 'off' }
            )
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for announcements (required if type is "channel")')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('announce-message')
        .setDescription('Set the custom level-up announcement message')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Message with {user}, {level}, {role} placeholders')
            .setRequired(true)
            .setMaxLength(200)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stack-roles')
        .setDescription('Toggle whether members keep all earned level roles')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable role stacking?')
            .setRequired(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getLevelingConfig(guildId);

      let description = '';

      if (subcommand === 'xp-range') {
        const min = interaction.options.getInteger('min', true);
        const max = interaction.options.getInteger('max', true);

        if (min > max) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Invalid Range', 'Minimum XP cannot be greater than maximum XP.')
                .setColor(Colors.Error)
            ]
          });
        }

        config.xpPerMessage = { min, max };
        description = `XP range set to **${min}-${max}** per message.`;
      } else if (subcommand === 'cooldown') {
        const seconds = interaction.options.getInteger('seconds', true);
        config.xpCooldownSeconds = seconds;
        description = `XP cooldown set to **${seconds}** seconds.`;
      } else if (subcommand === 'voice-xp') {
        const amount = interaction.options.getInteger('amount', true);
        config.xpPerVoiceMinute = amount;
        description = `Voice XP set to **${amount}** XP per minute.`;
      } else if (subcommand === 'announce') {
        const type = interaction.options.getString('type', true) as 'current' | 'channel' | 'dm' | 'off';
        const channel = interaction.options.getChannel('channel', false);

        if (type === 'channel' && !channel) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Missing Channel', 'You must specify a channel when using the "channel" announcement type.')
                .setColor(Colors.Error)
            ]
          });
        }

        config.announceType = type;
        if (channel) {
          config.announceChannelId = channel.id;
          description = `Announcements set to **${type}** in <#${channel.id}>.`;
        } else {
          config.announceChannelId = undefined;
          description = `Announcements set to **${type}**.`;
        }
      } else if (subcommand === 'announce-message') {
        const message = interaction.options.getString('message', true);
        config.announceMessage = message;
        description = `Announcement message updated.\n\n**Preview:** ${message.replace('{user}', '@User').replace('{level}', '50').replace('{role}', 'Role')}`;
      } else if (subcommand === 'stack-roles') {
        const enabled = interaction.options.getBoolean('enabled', true);
        config.stackRoles = enabled;
        description = `Role stacking **${enabled ? 'enabled' : 'disabled'}**. Members will ${enabled ? 'keep all earned roles' : 'only keep the highest level role'}.`;
      }

      // Save config
      await moduleConfig.setConfig(guildId, 'leveling', config);

      const embed = successEmbed('Config Updated', description)
        .setColor(Colors.Leveling)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[LevelConfig Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while updating the configuration.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
