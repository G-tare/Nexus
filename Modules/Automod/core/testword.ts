import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFields, addSeparator, V2Colors } from '../../../Shared/src/utils/componentsV2';
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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check for ManageMessages permission
    if (!interaction.member || typeof (interaction.member as any).permissions === 'string') {
      await interaction.reply({
        content: 'Unable to verify your permissions.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!(interaction.member as any).permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: 'You need the Manage Messages permission to use this command.',
        flags: MessageFlags.Ephemeral,
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

      // Build results container
      const container = moduleContainer('automod');
      addText(container, '### Automod Filter Test Results');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

      // Word Filter Results
      if (config.wordfilter.enabled) {
        if (results.wordFilter.matched) {
          fields.push({
            name: '⚠️ Word Filter - TRIGGERED',
            value: `Matched trigger: **${results.wordFilter.trigger}**`,
          });
        } else {
          fields.push({
            name: '✅ Word Filter - Passed',
            value: 'No filtered words detected',
          });
        }
      } else {
        fields.push({
          name: 'Word Filter - Disabled',
          value: 'This filter is not enabled',
        });
      }

      // Links Filter Results
      if (config.antilink.enabled) {
        if (results.links) {
          fields.push({
            name: '⚠️ Anti-Link - TRIGGERED',
            value: 'Disallowed link(s) detected',
          });
        } else {
          fields.push({
            name: '✅ Anti-Link - Passed',
            value: 'No disallowed links detected',
          });
        }
      } else {
        fields.push({
          name: 'Anti-Link - Disabled',
          value: 'This filter is not enabled',
        });
      }

      // Invites Filter Results
      if (config.antiinvite.enabled) {
        if (results.invites) {
          fields.push({
            name: '⚠️ Anti-Invite - TRIGGERED',
            value: 'Discord invite(s) detected',
          });
        } else {
          fields.push({
            name: '✅ Anti-Invite - Passed',
            value: 'No Discord invites detected',
          });
        }
      } else {
        fields.push({
          name: 'Anti-Invite - Disabled',
          value: 'This filter is not enabled',
        });
      }

      // Emojis Filter Results
      if (config.antispam.enabled && config.antispam.maxEmojis > 0) {
        if (results.emojis) {
          fields.push({
            name: '⚠️ Emoji Limit - TRIGGERED',
            value: `Too many emojis (max: ${config.antispam.maxEmojis})`,
          });
        } else {
          fields.push({
            name: '✅ Emoji Limit - Passed',
            value: `Emoji count within limit (max: ${config.antispam.maxEmojis})`,
          });
        }
      } else {
        fields.push({
          name: 'Emoji Limit - Disabled',
          value: 'This filter is not enabled',
        });
      }

      // Caps Filter Results
      if (config.antispam.enabled && config.antispam.maxCaps > 0) {
        if (results.caps) {
          fields.push({
            name: '⚠️ Caps Limit - TRIGGERED',
            value: `Too many capital letters (max: ${config.antispam.maxCaps}%)`,
          });
        } else {
          fields.push({
            name: '✅ Caps Limit - Passed',
            value: `Capital letter percentage within limit (max: ${config.antispam.maxCaps}%)`,
          });
        }
      } else {
        fields.push({
          name: 'Caps Limit - Disabled',
          value: 'This filter is not enabled',
        });
      }

      addFields(container, fields);

      // Summary section
      const triggeredCount = Object.values(results).filter((v) => {
        if (typeof v === 'object' && 'matched' in v) {
          return v.matched;
        }
        return v === true;
      }).length;

      addSeparator(container, 'small');

      if (triggeredCount > 0) {
        addText(container, `### Summary: ${triggeredCount} filter(s) triggered ⚠️\nThis message would be flagged by automod.`);
      } else {
        addText(container, '### Summary: All filters passed ✅\nThis message would not be flagged by automod.');
      }

      await interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in testword command:', error);
      await interaction.reply({
        content: 'Failed to test text against automod filters.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
