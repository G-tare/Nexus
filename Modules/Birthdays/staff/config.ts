import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBirthdayConfig, setBirthdayConfig } from '../helpers';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.config',
  premiumFeature: 'birthdays.basic',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('birthdayconfig')
    .setDescription('Configure birthday module settings (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current birthday configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable birthday module')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enable or disable').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the birthday announcement channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel for birthday announcements')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Set the birthday role (given for 24 hours)')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Birthday role (leave empty to remove)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('Set custom announcement message')
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Message with {user}, {username}, {age}, {server} variables')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('timezone')
        .setDescription('Set server timezone for birthday checks')
        .addStringOption((opt) =>
          opt
            .setName('timezone')
            .setDescription('IANA timezone (e.g., America/New_York, Europe/London)')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dm')
        .setDescription('Toggle DM notification on birthday')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Send DM on birthday').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('showage')
        .setDescription('Toggle age display in announcements')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Show age in birthday announcements').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guildId!;

      if (subcommand === 'view') {
        const config = await getBirthdayConfig(guildId);
        const embed = new EmbedBuilder()
          .setColor('#FF69B4')
          .setTitle('🎂 Birthday Configuration')
          .addFields(
            { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
            { name: 'Birthday Role', value: config.roleId ? `<@&${config.roleId}>` : 'Not set', inline: true },
            { name: 'Timezone', value: config.timezone, inline: true },
            { name: 'DM Notification', value: config.dmNotification ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Show Age', value: config.showAge ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Allow Hide Year', value: config.allowHideYear ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Announcement Message', value: `\`\`\`${config.announcementMessage}\`\`\``, inline: false }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
      }

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setBirthdayConfig(guildId, { enabled });
        return await interaction.editReply({
          content: `✅ Birthday module is now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        await setBirthdayConfig(guildId, { channelId: channel.id });
        return await interaction.editReply({
          content: `✅ Birthday announcement channel set to <#${channel.id}>.`,
        });
      }

      if (subcommand === 'role') {
        const role = interaction.options.getRole('role');
        await setBirthdayConfig(guildId, { roleId: role?.id || undefined });
        return await interaction.editReply({
          content: role
            ? `✅ Birthday role set to <@&${role.id}>. It will be given for 24 hours on a user's birthday.`
            : '✅ Birthday role cleared.',
        });
      }

      if (subcommand === 'message') {
        const message = interaction.options.getString('message', true);
        await setBirthdayConfig(guildId, { announcementMessage: message });
        return await interaction.editReply({
          content: `✅ Announcement message updated.\n**Preview:** ${message
            .replace('{user}', `<@${interaction.user.id}>`)
            .replace('{username}', interaction.user.username)
            .replace('{age}', '25')
            .replace('{server}', interaction.guild!.name)
          }`,
        });
      }

      if (subcommand === 'timezone') {
        const timezone = interaction.options.getString('timezone', true);

        // Validate timezone
        try {
          Intl.DateTimeFormat('en-US', { timeZone: timezone });
        } catch {
          return await interaction.editReply({
            content: '❌ Invalid timezone. Use IANA format like `America/New_York`, `Europe/London`, `Asia/Tokyo`.',
          });
        }

        await setBirthdayConfig(guildId, { timezone });
        return await interaction.editReply({
          content: `✅ Server timezone set to **${timezone}**. Birthdays will be checked based on this timezone.`,
        });
      }

      if (subcommand === 'dm') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setBirthdayConfig(guildId, { dmNotification: enabled });
        return await interaction.editReply({
          content: `✅ Birthday DM notifications are now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }

      if (subcommand === 'showage') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setBirthdayConfig(guildId, { showAge: enabled });
        return await interaction.editReply({
          content: `✅ Age display in announcements is now ${enabled ? 'enabled' : 'disabled'}.`,
        });
      }
    } catch (error) {
      console.error('[Birthdays] /birthdayconfig error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while updating configuration.',
      });
    }
  },
};

export default command;
