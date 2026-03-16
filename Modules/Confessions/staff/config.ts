import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getConfessionConfig, setConfessionConfig } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.confession-config',
  data: new SlashCommandBuilder()
    .setName('confession-config')
    .setDescription('Configure confessions module')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View current confession settings')
    )
    .addSubcommand(sub =>
      sub
        .setName('channel')
        .setDescription('Set the confession channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Text channel for confessions')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('moderation')
        .setDescription('Configure moderation queue')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable moderation queue')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Moderation queue channel (required if enabled)')
            .setRequired(false)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('anonymity')
        .setDescription('Set full anonymity mode')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Enable full anonymity (no one can see who confessed)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('cooldown')
        .setDescription('Set confession cooldown')
        .addIntegerOption(opt =>
          opt
            .setName('seconds')
            .setDescription('Cooldown in seconds (0-3600)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(3600)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('blacklist-add')
        .setDescription('Add a blacklisted word')
        .addStringOption(opt =>
          opt
            .setName('word')
            .setDescription('Word to blacklist')
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('blacklist-remove')
        .setDescription('Remove a blacklisted word')
        .addStringOption(opt =>
          opt
            .setName('word')
            .setDescription('Word to remove from blacklist')
            .setRequired(true)
            .setMaxLength(100)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('blacklist-list')
        .setDescription('View all blacklisted words')
    )
    .addSubcommand(sub =>
      sub
        .setName('images')
        .setDescription('Toggle image attachments')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Allow images in confessions')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('color')
        .setDescription('Set embed color')
        .addStringOption(opt =>
          opt
            .setName('color')
            .setDescription('Hex color code (e.g., #9B59B6)')
            .setRequired(true)
            .setMaxLength(7)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const config = await getConfessionConfig(guildId);

    try {
      if (subcommand === 'view') {
        const container = moduleContainer('confessions');
        addText(container, '### Confession Configuration');
        addFields(container, [
          { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
          { name: 'Confession Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
          { name: 'Moderation', value: config.moderationEnabled ? 'Enabled' : 'Disabled', inline: true },
          { name: 'Moderation Channel', value: config.moderationChannelId ? `<#${config.moderationChannelId}>` : 'Not set', inline: true },
          { name: 'Full Anonymity', value: config.fullAnonymity ? 'Yes' : 'No', inline: true },
          { name: 'Cooldown', value: `${config.cooldownSeconds}s`, inline: true },
          { name: 'Images Allowed', value: config.allowImages ? 'Yes' : 'No', inline: true },
          { name: 'Embed Color', value: config.embedColor, inline: true },
          { name: 'Blacklisted Words', value: config.blacklistedWords.length > 0 ? config.blacklistedWords.join(', ') : 'None', inline: false },
          { name: 'Banned Users', value: `${config.bannedHashes.length} user(s)`, inline: true },
          { name: 'Total Confessions', value: `${config.confessionCounter}`, inline: true },
        ]);

        await interaction.reply(v2Payload([container]));
      } else if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        config.channelId = channel.id;
        config.enabled = true;
        await setConfessionConfig(guildId, { channelId: channel.id, enabled: true });

        await interaction.reply({
          content: `Confession channel set to ${channel}.`,
        });
      } else if (subcommand === 'moderation') {
        const enabled = interaction.options.getBoolean('enabled', true);
        const modChannel = interaction.options.getChannel('channel', false);

        if (enabled && !modChannel) {
          await interaction.reply({
            content: 'Moderation channel is required when enabling moderation.',
          });
          return;
        }

        await setConfessionConfig(guildId, {
          moderationEnabled: enabled,
          moderationChannelId: modChannel?.id || undefined,
        });

        const status = enabled ? `enabled (${modChannel})` : 'disabled';
        await interaction.reply({
          content: `Moderation queue ${status}.`,
        });
      } else if (subcommand === 'anonymity') {
        const fullAnonymity = interaction.options.getBoolean('enabled', true);
        await setConfessionConfig(guildId, { fullAnonymity });

        const message = fullAnonymity
          ? 'Full anonymity enabled. No one, not even the server owner, can see who confessed.'
          : 'Full anonymity disabled. Server owner can reveal confession authors.';

        await interaction.reply({
          content: message,
        });
      } else if (subcommand === 'cooldown') {
        const seconds = interaction.options.getInteger('seconds', true);
        await setConfessionConfig(guildId, { cooldownSeconds: seconds });

        await interaction.reply({
          content: `Confession cooldown set to ${seconds} seconds.`,
        });
      } else if (subcommand === 'blacklist-add') {
        const word = interaction.options.getString('word', true);

        if (config.blacklistedWords.includes(word.toLowerCase())) {
          await interaction.reply({
            content: 'This word is already blacklisted.',
          });
          return;
        }

        config.blacklistedWords.push(word.toLowerCase());
        await setConfessionConfig(guildId, { blacklistedWords: config.blacklistedWords });

        await interaction.reply({
          content: `Blacklisted word added: ${word}`,
        });
      } else if (subcommand === 'blacklist-remove') {
        const word = interaction.options.getString('word', true);

        const index = config.blacklistedWords.indexOf(word.toLowerCase());
        if (index === -1) {
          await interaction.reply({
            content: 'This word is not blacklisted.',
          });
          return;
        }

        config.blacklistedWords.splice(index, 1);
        await setConfessionConfig(guildId, { blacklistedWords: config.blacklistedWords });

        await interaction.reply({
          content: `Blacklisted word removed: ${word}`,
        });
      } else if (subcommand === 'blacklist-list') {
        if (config.blacklistedWords.length === 0) {
          await interaction.reply({
            content: 'No words are currently blacklisted.',
          });
          return;
        }

        const wordList = config.blacklistedWords.map((w, i) => `${i + 1}. ${w}`).join('\n');
        await interaction.reply({
          content: `**Blacklisted Words:**\n${wordList}`,
        });
      } else if (subcommand === 'images') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await setConfessionConfig(guildId, { allowImages: enabled });

        await interaction.reply({
          content: `Image attachments are now ${enabled ? 'allowed' : 'disabled'}.`,
        });
      } else if (subcommand === 'color') {
        const color = interaction.options.getString('color', true);

        // Validate hex color
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          await interaction.reply({
            content: 'Invalid hex color. Use format: #RRGGBB',
          });
          return;
        }

        await setConfessionConfig(guildId, { embedColor: color });

        await interaction.reply({
          content: `Embed color set to ${color}.`,
        });
      }
    } catch (error) {
      console.error('Error in confession config command:', error);
      await interaction.reply({
        content: 'An error occurred.',
      });
    }
  },
};

export default command;
