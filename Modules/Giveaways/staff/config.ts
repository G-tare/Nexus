import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, Role } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

interface GiveawayConfig {
  defaultChannel?: string;
  reactionEmoji?: string;
  buttonMode?: boolean;
  dmWinners?: boolean;
  pingRole?: string | null;
  embedColor?: string;
  endAction?: 'edit' | 'delete';
  maxActive?: number;
  allowSelfEntry?: boolean;
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway-config')
    .setDescription('Configure giveaway settings for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    
    .addSubcommand((sub) => sub.setName('view').setDescription('View all giveaway settings'))
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set default giveaway channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Default channel for giveaways')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('emoji')
        .setDescription('Set reaction emoji for giveaways')
        .addStringOption((opt) =>
          opt
            .setName('emoji')
            .setDescription('Emoji to use for reactions')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('buttons')
        .setDescription('Toggle button mode for giveaways')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable button mode')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('dm-winners')
        .setDescription('Toggle direct messages to giveaway winners')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable DM winners')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ping-role')
        .setDescription('Set role to ping when giveaways start')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to ping (leave empty to disable)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set giveaway embed color')
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Hex color code (e.g., #2f3136)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end-action')
        .setDescription('Set what happens to giveaway message when it ends')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to take on giveaway end')
            .setRequired(true)
            .addChoices(
              { name: 'Edit message', value: 'edit' },
              { name: 'Delete message', value: 'delete' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-active')
        .setDescription('Set maximum active giveaways')
        .addIntegerOption((opt) =>
          opt
            .setName('max')
            .setDescription('Maximum concurrent giveaways')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('self-entry')
        .setDescription('Allow giveaway hosts to enter their own giveaways')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Allow self entry')
            .setRequired(true)
        )
    ),

  module: 'giveaways',
  permissionPath: 'giveaways.staff.config',
  premiumFeature: 'giveaways.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const _curCfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'giveaways');
    const currentConfig = (_curCfgResult?.config ?? {}) as Record<string, any>;

    try {
      switch (subcommand) {
        case 'view': {
          const config = currentConfig || {};
          return interaction.reply({
            embeds: [
              {
                title: 'Giveaway Configuration',
                fields: [
                  {
                    name: 'Default Channel',
                    value: config.defaultChannel ? `<#${config.defaultChannel}>` : 'Not set',
                    inline: true,
                  },
                  {
                    name: 'Reaction Emoji',
                    value: config.reactionEmoji || '🎉',
                    inline: true,
                  },
                  {
                    name: 'Button Mode',
                    value: config.buttonMode ? 'Enabled' : 'Disabled',
                    inline: true,
                  },
                  {
                    name: 'DM Winners',
                    value: config.dmWinners ? 'Enabled' : 'Disabled',
                    inline: true,
                  },
                  {
                    name: 'Ping Role',
                    value: config.pingRole ? `<@&${config.pingRole}>` : 'Not set',
                    inline: true,
                  },
                  {
                    name: 'Embed Color',
                    value: config.embedColor || '#2f3136',
                    inline: true,
                  },
                  {
                    name: 'End Action',
                    value: config.endAction || 'edit',
                    inline: true,
                  },
                  {
                    name: 'Max Active Giveaways',
                    value: String(config.maxActive || 10),
                    inline: true,
                  },
                  {
                    name: 'Allow Self Entry',
                    value: config.allowSelfEntry ? 'Enabled' : 'Disabled',
                    inline: true,
                  },
                ],
                color: 0x2f3136,
              },
            ],
            ephemeral: true,
          });
        }

        case 'channel': {
          const channel = interaction.options.getChannel('channel', true) as TextChannel;
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            defaultChannel: channel.id,
          });
          return interaction.reply({
            content: `Default giveaway channel set to ${channel}.`,
            ephemeral: true,
          });
        }

        case 'emoji': {
          const emoji = interaction.options.getString('emoji', true);
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            reactionEmoji: emoji,
          });
          return interaction.reply({
            content: `Reaction emoji set to ${emoji}.`,
            ephemeral: true,
          });
        }

        case 'buttons': {
          const enabled = interaction.options.getBoolean('enabled', true);
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            buttonMode: enabled,
          });
          return interaction.reply({
            content: `Button mode ${enabled ? 'enabled' : 'disabled'}.`,
            ephemeral: true,
          });
        }

        case 'dm-winners': {
          const enabled = interaction.options.getBoolean('enabled', true);
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            dmWinners: enabled,
          });
          return interaction.reply({
            content: `Giveaway winner DMs ${enabled ? 'enabled' : 'disabled'}.`,
            ephemeral: true,
          });
        }

        case 'ping-role': {
          const role = interaction.options.getRole('role');
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            pingRole: role?.id || null,
          });
          return interaction.reply({
            content: role
              ? `Ping role set to ${role}.`
              : 'Ping role disabled.',
            ephemeral: true,
          });
        }

        case 'color': {
          const color = interaction.options.getString('color', true);

          // Validate hex color
          if (!/^#[0-9A-F]{6}$/i.test(color)) {
            return interaction.reply({
              content: 'Invalid hex color. Please use format: #RRGGBB',
              ephemeral: true,
            });
          }

          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            embedColor: color,
          });
          return interaction.reply({
            content: `Embed color set to ${color}.`,
            ephemeral: true,
          });
        }

        case 'end-action': {
          const action = interaction.options.getString('action', true) as 'edit' | 'delete';
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            endAction: action,
          });
          return interaction.reply({
            content: `End action set to ${action}.`,
            ephemeral: true,
          });
        }

        case 'max-active': {
          const max = interaction.options.getInteger('max', true);
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            maxActive: max,
          });
          return interaction.reply({
            content: `Maximum active giveaways set to ${max}.`,
            ephemeral: true,
          });
        }

        case 'self-entry': {
          const enabled = interaction.options.getBoolean('enabled', true);
          await moduleConfig.setConfig(interaction.guildId!, 'giveaways', {
            ...currentConfig,
            allowSelfEntry: enabled,
          });
          return interaction.reply({
            content: `Self entry ${enabled ? 'enabled' : 'disabled'}.`,
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      console.error('Error updating giveaway config:', error);
      return interaction.reply({
        content: 'An error occurred while updating configuration.',
        ephemeral: true,
      });
    }
  },
};

export default command;
