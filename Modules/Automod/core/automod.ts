import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, infoEmbed } from '../../../Shared/src/utils/embed';
import { getAutomodConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('View current automod settings overview')
    ,

  module: 'automod',
  permissionPath: 'automod',
  premiumFeature: 'automod.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a guild.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const config = await getAutomodConfig(interaction.guildId!);

      // Build the comprehensive embed
      const embed = new EmbedBuilder()
        .setTitle('Automod Configuration Overview')
        .setColor(Colors.Info)
        .setTimestamp();

      // Anti-Spam Section
      const antiSpamStatus = config.antispam.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Anti-Spam ${config.antispam.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${antiSpamStatus}\n` +
          `Rate Limit: ${config.antispam.maxMessages} messages per ${config.antispam.timeframeSeconds}s\n` +
          `Duplicate Threshold: ${config.antispam.duplicateThreshold}\n` +
          `Max Emojis: ${config.antispam.maxEmojis}\n` +
          `Max Caps: ${config.antispam.maxCaps}%\n` +
          `Max Mentions: ${config.antispam.maxMentions}`,
        inline: false,
      });

      // Anti-Raid Section
      const antiRaidStatus = config.antiraid.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Anti-Raid ${config.antiraid.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${antiRaidStatus}\n` +
          `Threshold: ${config.antiraid.joinThreshold} joins per ${config.antiraid.timeframeSeconds}s\n` +
          `Min Account Age: ${config.antiraid.minAccountAgeDays} days\n` +
          `Action: ${config.antiraid.action}\n` +
          `Lockdown Duration: ${config.antiraid.lockdownDurationMinutes} minutes`,
        inline: false,
      });

      // Anti-Link Section
      const antiLinkStatus = config.antilink.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Anti-Link ${config.antilink.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${antiLinkStatus}\n` +
          `Whitelisted Domains: ${config.antilink.whitelistedDomains.length}\n` +
          `Blacklisted Domains: ${config.antilink.blacklistedDomains.length}\n` +
          `Allowed Channels: ${config.antilink.allowedChannels.length}\n` +
          `Allowed Roles: ${config.antilink.allowedRoles.length}`,
        inline: false,
      });

      // Anti-Invite Section
      const antiInviteStatus = config.antiinvite.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Anti-Invite ${config.antiinvite.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${antiInviteStatus}\n` +
          `Allowed Servers: ${config.antiinvite.allowedServers.length}\n` +
          `Allowed Roles: ${config.antiinvite.allowedRoles.length}`,
        inline: false,
      });

      // Word Filter Section
      const wordFilterStatus = config.wordfilter.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Word Filter ${config.wordfilter.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${wordFilterStatus}\n` +
          `Filtered Words: ${config.wordfilter.words.length}\n` +
          `Wildcard Patterns: ${config.wordfilter.wildcards.length}\n` +
          `Regex Patterns: ${config.wordfilter.regexPatterns.length}`,
        inline: false,
      });

      // Anti-Nuke Section
      const antiNukeStatus = config.antinuke.enabled ? '✅ Enabled' : '❌ Disabled';
      embed.addFields({
        name: `Anti-Nuke ${config.antinuke.enabled ? '✅' : '❌'}`,
        value:
          `Status: ${antiNukeStatus}\n` +
          `Max Channel Deletes/min: ${config.antinuke.maxChannelDeletesPerMinute}\n` +
          `Max Role Deletes/min: ${config.antinuke.maxRoleDeletesPerMinute}\n` +
          `Max Bans/min: ${config.antinuke.maxBansPerMinute}\n` +
          `Max Webhook Creates/min: ${config.antinuke.maxWebhookCreatesPerMinute}\n` +
          `Action: ${config.antinuke.action}`,
        inline: false,
      });

      // Punishment Escalation Section
      const punishmentLevels = Object.entries(config.punishments)
        .map(([level, action]) => {
          let actionStr = '';
          switch (action.type) {
            case 'delete':
              actionStr = 'Delete Message';
              break;
            case 'warn':
              actionStr = 'Warn User';
              break;
            case 'mute':
              actionStr = `Mute (${action.duration}s)`;
              break;
            case 'kick':
              actionStr = 'Kick User';
              break;
            case 'ban':
              actionStr = 'Ban User';
              break;
          }
          return `Level ${level}: ${actionStr}`;
        })
        .join('\n');

      embed.addFields({
        name: 'Punishment Escalation',
        value: punishmentLevels || 'No punishments configured',
        inline: false,
      });

      // Exemptions Section
      embed.addFields({
        name: 'Exemptions',
        value:
          `Exempt Roles: ${config.exemptRoles.length}\n` +
          `Exempt Channels: ${config.exemptChannels.length}\n` +
          `Exempt Users: ${config.exemptUsers.length}`,
        inline: false,
      });

      // Logging Section
      const logChannelInfo = config.logChannelId
        ? `<#${config.logChannelId}>`
        : 'Not set';
      embed.addFields({
        name: 'Logging',
        value: `Log Channel: ${logChannelInfo}`,
        inline: false,
      });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error in automod command:', error);
      await interaction.reply({
        content: 'Failed to retrieve automod configuration.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
