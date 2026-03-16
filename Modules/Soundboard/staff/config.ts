import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Soundboard:Config');

const command: BotCommand = {
  module: 'soundboard',
  permissionPath: 'soundboard.staff.config',
  data: new SlashCommandBuilder()
    .setName('soundboard-config')
    .setDescription('Manage Soundboard module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View soundboard settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-sounds')
        .setDescription('Set maximum custom sounds')
        .addIntegerOption((opt) =>
          opt
            .setName('count')
            .setDescription('Maximum custom sounds')
            .setMinValue(5)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('user-upload')
        .setDescription('Allow non-staff to upload sounds')
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Enable or disable user uploads')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set cooldown between plays')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Cooldown in seconds')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'soundboard');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      switch (subcommand) {
        case 'view': {
          const container = moduleContainer('soundboard');
          addText(container, `### ⚙️ Soundboard Configuration\nSettings for **${interaction.guild?.name}**`);
          addFields(container, [
            {
              name: 'Max Custom Sounds',
              value: `${config.maxCustomSounds || 25}`,
              inline: true,
            },
            {
              name: 'Max Duration',
              value: `${config.maxDuration || 10}s`,
              inline: true,
            },
            {
              name: 'User Uploads',
              value: config.allowUserUpload ? '✅ Enabled' : '❌ Disabled',
              inline: true,
            },
            {
              name: 'Cooldown',
              value: `${config.cooldown || 5}s`,
              inline: true,
            }
          ]);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'max-sounds': {
          const count = interaction.options.getInteger('count', true);
          config.maxCustomSounds = count;

          await moduleConfig.setConfig(guildId, 'soundboard', config);

          const container = moduleContainer('soundboard');
          addText(container, `### ✅ Max Sounds Updated\nMaximum custom sounds set to **${count}**`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'user-upload': {
          const enabled = interaction.options.getBoolean('enabled', true);
          config.allowUserUpload = enabled;

          await moduleConfig.setConfig(guildId, 'soundboard', config);

          const container = moduleContainer('soundboard');
          addText(container, `### ✅ User Uploads Updated\nUser sound uploads are now **${enabled ? 'enabled' : 'disabled'}**`);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'cooldown': {
          const seconds = interaction.options.getInteger('seconds', true);
          config.cooldown = seconds;

          await moduleConfig.setConfig(guildId, 'soundboard', config);

          const container = moduleContainer('soundboard');
          addText(container, `### ✅ Cooldown Updated\nCooldown between plays set to **${seconds}s**`);

          await interaction.reply(v2Payload([container]));
          break;
        }
      }
    } catch (error) {
      logger.error('Error in soundboard config command:', error);
      await interaction.reply({
        content: 'An error occurred while managing soundboard settings.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
