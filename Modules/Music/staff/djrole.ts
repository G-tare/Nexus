import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  Role, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successContainer, errorContainer, moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const MUSIC_COMMANDS = [
  'play',
  'pause',
  'resume',
  'skip',
  'stop',
  'seek',
  'previous',
  'queue',
  'shuffle',
  'loop',
  'remove',
  'move',
  'clear',
  'skipto',
  'volume',
  'filters',
  'voteskip',
];

const command: BotCommand = {
  name: 'djrole',
  module: 'music',
  permissionPath: 'music.djrole',
  data: new SlashCommandBuilder()
    .setName('djrole')
    .setDescription('Manage DJ role settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set the DJ role')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('The role to set as DJ role')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove the DJ role')
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable the DJ system')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable DJ system')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('commands')
        .setDescription('Set which commands require DJ role')
        .addStringOption((opt) =>
          opt
            .setName('command')
            .setDescription('Command name')
            .setRequired(true)
            .addChoices(
              ...MUSIC_COMMANDS.map((cmd) => ({
                name: cmd,
                value: cmd,
              }))
            )
        )
        .addBooleanOption((opt) =>
          opt
            .setName('required')
            .setDescription('Require DJ role for this command')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the **Manage Guild** permission to use this command.',
      });
      return;
    }

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      switch (subcommand) {
        case 'set': {
          const role = interaction.options.getRole('role', true);

          config.djEnabled = true;
          config.djRoleId = role.id;

          moduleConfig.setConfig(guildId, 'music', config);

          const container = successContainer('DJ Role Set', `DJ role set to ${role}.`);
          addFooter(container, 'DJ system is now enabled');

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'remove': {
          config.djEnabled = false;
          config.djRoleId = null;
          config.djOnlyCommands = [];

          moduleConfig.setConfig(guildId, 'music', config);

          const container = errorContainer('DJ Role Removed', 'DJ role has been removed and the DJ system is disabled.');

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);

          if (enabled && !config.djRoleId) {
            await interaction.reply({
              content:
                'You must set a DJ role before enabling the DJ system. Use `/djrole set` first.',
            });
            return;
          }

          config.djEnabled = enabled;
          moduleConfig.setConfig(guildId, 'music', config);

          const container = enabled ? successContainer('DJ System Toggled', 'DJ system is now **enabled**.') : errorContainer('DJ System Toggled', 'DJ system is now **disabled**.');

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'commands': {
          const cmdName = interaction.options.getString('command', true);
          const required = interaction.options.getBoolean('required', true);

          if (!config.djOnlyCommands) {
            config.djOnlyCommands = [];
          }

          const index = config.djOnlyCommands.indexOf(cmdName);

          if (required) {
            if (index === -1) {
              config.djOnlyCommands.push(cmdName);
            }
          } else {
            if (index > -1) {
              config.djOnlyCommands.splice(index, 1);
            }
          }

          moduleConfig.setConfig(guildId, 'music', config);

          const container = moduleContainer('music');
          addText(container, `### DJ Command Updated\n**/${cmdName}** now **${required ? 'requires' : 'does not require'}** DJ role.`);
          addFooter(container, `${config.djOnlyCommands.length} command(s) require DJ role`);

          await interaction.reply(v2Payload([container]));
          break;
        }
      }
    } catch (error) {
      console.error('Error in djrole command:', error);
      await interaction.reply({
        content: 'An error occurred while managing DJ settings.',
      });
    }
  },
};

export default command;
