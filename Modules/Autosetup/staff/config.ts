import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, v2Payload, infoReply, successReply, errorReply } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Autosetup:Config');

const command: BotCommand = {
  module: 'autosetup',
  permissionPath: 'autosetup.staff.config',
  data: new SlashCommandBuilder()
    .setName('autosetup-config')
    .setDescription('Manage Autosetup module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View autosetup settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('category-name')
        .setDescription('Set the category name for created channels')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Category name')
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
            .setDescription('Hex color code (e.g., #1ABC9C)')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    try {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'autosetup');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      switch (subcommand) {
        case 'view': {
          const container = moduleContainer('autosetup');
          addText(container, `### ⚙️ Autosetup Configuration\nSettings for **${interaction.guild?.name}**`);
          addText(container, `**Category Name**\n\`${config.categoryName || 'Bot Setup'}\``);
          addText(container, `**Embed Color**\n\`${config.embedColor || '#1ABC9C'}\``);

          await interaction.reply(v2Payload([container]));
          break;
        }

        case 'category-name': {
          const name = interaction.options.getString('name', true);
          config.categoryName = name;

          await moduleConfig.setConfig(guildId, 'autosetup', config);

          await interaction.reply(successReply('Category Name Updated', `Category name set to **${name}**`));
          break;
        }

        case 'color': {
          const hex = interaction.options.getString('hex', true);

          // Validate hex
          if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
            await interaction.reply({
              content: '❌ Invalid hex color code. Use format: `#1ABC9C`',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          config.embedColor = hex.startsWith('#') ? hex : `#${hex}`;

          await moduleConfig.setConfig(guildId, 'autosetup', config);

          const container = moduleContainer('autosetup');
          addText(container, '### ✅ Color Updated');
          addText(container, `Embed color set to **${config.embedColor}**`);

          await interaction.reply(v2Payload([container]));
          break;
        }
      }
    } catch (error) {
      logger.error('Error in autosetup config command:', error);
      await interaction.reply({
        content: 'An error occurred while managing autosetup settings.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
