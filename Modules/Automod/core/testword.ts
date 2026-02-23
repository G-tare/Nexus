import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed, warningEmbed } from '../../../Shared/src/utils/embed';
import {
  getAutomodConfig,
  checkWordFilter,
  checkLinks,
  checkInvites,
  checkEmojis,
  checkCaps,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('testword')
    .setDescription('Test if text triggers any automod filter')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('Text to test against automod filters')
        .setRequired(true)
        .setMaxLength(2000)
    )
    ,

  module: 'automod',
  permissionPath: 'automod.staff.testword',
  defaultPermissions: PermissionFlagsBits.ManageMessages,
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a guild.',
        ephemeral: true,
      });
      return;
    }

    // Check for ManageMessages permission
    if (!interaction.member || typeof (interaction.member as any).permissions === 'string') {
      await interaction.reply({
        content: 'Unable to verify your permissions.',
        ephemeral: true,
      });
      return;
    }

    if (!(interaction.member as any).permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: 'You need the Manage Messages permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    const testText = interaction.options.getString('text', true);

    try {
      const config = await getAutomodConfig(interaction.guildId!);

      // Run all filter checks
      const results = {
        wordFilter: checkWordFilter(testText, config.wordfilter),
        links: checkLinks(testText, config.antilink),
        invites: checkInvites(testText),
        emojis: checkEmojis(testText, config.antispam.maxEmojis),
        caps: checkCaps(
          testText,
          config.antispam.maxCaps,
          config.antispam.minMessageLength
        ),
      };

      // Build results embed
      const embed = new EmbedBuilder()
        .setTitle('Automod Filter Test Results')
        .setColor(Colors.Info)
        .setTimestamp();

      // Word Filter Results
      if (config.wordfilter.enabled) {
        if (results.wordFilter.matched) {
          embed.addFields({
            name: '⚠️ Word Filter - TRIGGERED',
            value: `Matched trigger: **${results.wordFilter.trigger}**`,
            inline: false,
          });
        } else {
          embed.addFields({
            name: '✅ Word Filter - Passed',
            value: 'No filtered words detected',
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Word Filter - Disabled',
          value: 'This filter is not enabled',
          inline: false,
        });
      }

      // Links Filter Results
      if (config.antilink.enabled) {
        if (results.links) {
          embed.addFields({
            name: '⚠️ Anti-Link - TRIGGERED',
            value: 'Disallowed link(s) detected',
            inline: false,
          });
        } else {
          embed.addFields({
            name: '✅ Anti-Link - Passed',
            value: 'No disallowed links detected',
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Anti-Link - Disabled',
          value: 'This filter is not enabled',
          inline: false,
        });
      }

      // Invites Filter Results
      if (config.antiinvite.enabled) {
        if (results.invites) {
          embed.addFields({
            name: '⚠️ Anti-Invite - TRIGGERED',
            value: 'Discord invite(s) detected',
            inline: false,
          });
        } else {
          embed.addFields({
            name: '✅ Anti-Invite - Passed',
            value: 'No Discord invites detected',
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Anti-Invite - Disabled',
          value: 'This filter is not enabled',
          inline: false,
        });
      }

      // Emojis Filter Results
      if (config.antispam.enabled && config.antispam.maxEmojis > 0) {
        if (results.emojis) {
          embed.addFields({
            name: '⚠️ Emoji Limit - TRIGGERED',
            value: `Too many emojis (max: ${config.antispam.maxEmojis})`,
            inline: false,
          });
        } else {
          embed.addFields({
            name: '✅ Emoji Limit - Passed',
            value: `Emoji count within limit (max: ${config.antispam.maxEmojis})`,
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Emoji Limit - Disabled',
          value: 'This filter is not enabled',
          inline: false,
        });
      }

      // Caps Filter Results
      if (config.antispam.enabled && config.antispam.maxCaps > 0) {
        if (results.caps) {
          embed.addFields({
            name: '⚠️ Caps Limit - TRIGGERED',
            value: `Too many capital letters (max: ${config.antispam.maxCaps}%)`,
            inline: false,
          });
        } else {
          embed.addFields({
            name: '✅ Caps Limit - Passed',
            value: `Capital letter percentage within limit (max: ${config.antispam.maxCaps}%)`,
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Caps Limit - Disabled',
          value: 'This filter is not enabled',
          inline: false,
        });
      }

      // Summary section
      const triggeredCount = Object.values(results).filter((v) => {
        if (typeof v === 'object' && 'matched' in v) {
          return v.matched;
        }
        return v === true;
      }).length;

      const summaryColor =
        triggeredCount > 0 ? Colors.Warning : Colors.Success;
      embed.setColor(summaryColor as any);

      if (triggeredCount > 0) {
        embed.addFields({
          name: `Summary: ${triggeredCount} filter(s) triggered ⚠️`,
          value: 'This message would be flagged by automod.',
          inline: false,
        });
      } else {
        embed.addFields({
          name: 'Summary: All filters passed ✅',
          value: 'This message would not be flagged by automod.',
          inline: false,
        });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error in testword command:', error);
      await interaction.reply({
        content: 'Failed to test text against automod filters.',
        ephemeral: true,
      });
    }
  },
};

export default command;
