import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Welcome:Greet');

const greet: BotCommand = {
  module: 'welcome',
  permissionPath: 'welcome.staff.greet',
  data: new SlashCommandBuilder()
    .setName('greet')
    .setDescription('Configure first-message greeting for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable member greetings')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable greetings')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the channel where greetings are sent')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel for greetings (leave empty to greet in first message channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('message')
        .setDescription('Set the greeting message')
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Greeting message (supports {user}, {username}, {server})')
            .setMaxLength(1000)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    try {
      const _curCfgResult = await moduleConfig.getModuleConfig(guildId, 'welcome');
      const _curCfg = (_curCfgResult?.config ?? {}) as Record<string, any>;
      const currentConfig = (_curCfg?.config ?? {}) as any;

      if (subcommand === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          greet: {
            ...currentConfig.greet,
            enabled,
          },
        });

        return interaction.editReply(
          `✅ Member greetings have been **${enabled ? 'enabled' : 'disabled'}**.`
        );
      }

      if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('channel', false);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          greet: {
            ...currentConfig.greet,
            channelId: channel?.id || null,
          },
        });

        return interaction.editReply(
          channel
            ? `✅ Greeting channel set to ${channel}.`
            : `✅ Greetings will now be sent in each member's first message channel.`
        );
      }

      if (subcommand === 'message') {
        const message = interaction.options.getString('message', true);

        await moduleConfig.setConfig(guildId, 'welcome', {
          ...currentConfig,
          greet: {
            ...currentConfig.greet,
            message,
          },
        });

        return interaction.editReply(
          `✅ Greeting message updated.\n\n**Preview:**\n${message}`
        );
      }
    } catch (error) {
      logger.error('Error in greet command:', error);
      return interaction.editReply(
        '❌ An error occurred while updating greeting settings.'
      );
    }
  },
};

export default greet;
