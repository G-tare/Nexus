import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, addSeparator, v2Payload, successContainer, errorContainer } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Utilities:Config');

const command: BotCommand = {
  module: 'utilities',
  permissionPath: 'utilities.staff.config',
  data: new SlashCommandBuilder()
    .setName('utilities-config')
    .setDescription('Manage Utilities module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View all utilities settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set search command cooldown')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Cooldown in seconds')
            .setMinValue(1)
            .setMaxValue(3600)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-notes')
        .setDescription('Set maximum notes per user')
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('Maximum notes')
            .setMinValue(5)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set embed color')
        .addStringOption((opt) =>
          opt
            .setName('hex')
            .setDescription('Hex color code (e.g., #2ECC71)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('notepad-toggle')
        .setDescription('Toggle notepad feature')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'utilities');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      switch (subcommand) {
        case 'view': {
          const container = moduleContainer('utilities');
          addText(container, '### ⚙️ Utilities Configuration');
          addText(container, `Settings for **${interaction.guild?.name}**`);
          addSeparator(container, 'small');
          addFields(container, [
            {
              name: 'Embed Color',
              value: `\`${config.embedColor || '#2ECC71'}\``,
              inline: true,
            },
            {
              name: 'Search Cooldown',
              value: `${config.searchCooldown || 5} seconds`,
              inline: true,
            },
            {
              name: 'Max Notes per User',
              value: `${config.maxNotes || 25}`,
              inline: true,
            },
            {
              name: 'Notepad Enabled',
              value: config.notepadEnabled ? '✅ Yes' : '❌ No',
              inline: true,
            }
          ]);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'cooldown': {
          const cooldown = interaction.options.getInteger('seconds', true);
          config.searchCooldown = cooldown;

          await moduleConfig.setConfig(guildId, 'utilities', config);

          await interaction.reply(v2Payload([successContainer('Cooldown Updated', `Search cooldown set to **${cooldown}** seconds`)]));
          break;
        }

        case 'max-notes': {
          const count = interaction.options.getInteger('count', true);
          config.maxNotes = count;

          await moduleConfig.setConfig(guildId, 'utilities', config);

          await interaction.reply(v2Payload([successContainer('Max Notes Updated', `Maximum notes per user set to **${count}**`)]));
          break;
        }

        case 'color': {
          const hex = interaction.options.getString('hex', true);

          // Validate hex
          if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
            await interaction.reply({
              content: '❌ Invalid hex color code. Use format: `#FF5733`',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          config.embedColor = hex.startsWith('#') ? hex : `#${hex}`;

          await moduleConfig.setConfig(guildId, 'utilities', config);

          await interaction.reply(v2Payload([successContainer('Color Updated', `Embed color set to **${config.embedColor}**`)]));
          break;
        }

        case 'notepad-toggle': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.notepadEnabled = enabled;

          await moduleConfig.setConfig(guildId, 'utilities', config);

          if (enabled) {
            await interaction.reply(v2Payload([successContainer('Notepad Enabled', 'Notepad feature is now **enabled**')]));
          } else {
            await interaction.reply(v2Payload([errorContainer('Notepad Disabled', 'Notepad feature is now **disabled**')]));
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Error in utilities config command:', error);
      await interaction.reply({
        content: 'An error occurred while managing utilities settings.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
