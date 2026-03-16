import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, addSeparator, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { ContainerBuilder } from 'discord.js';
const logger = createModuleLogger('CustomCommands');

export const listCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.list',
  data: new SlashCommandBuilder()
    .setName('clist')
    .setDescription('List all custom commands in this server')
    .addStringOption(option =>
      option
        .setName('search')
        .setDescription('Search for a specific command')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  async execute(interaction: ChatInputCommandInteraction, helpers: any) {
    const helper = helpers.customcommands as CustomCommandsHelper;

    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.'
      });
      return;
    }

    // Check permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the "Manage Guild" permission to use this command.'
      });
      return;
    }

    try {
      const search = interaction.options.getString('search')?.toLowerCase();
      const commands = await helper.getGuildCommands(interaction.guildId!);

      if (commands.length === 0) {
        await interaction.reply({
          content: 'There are no custom commands in this server yet.'
        });
        return;
      }

      let filtered = commands;
      if (search) {
        filtered = commands.filter(
          cmd =>
            cmd.name.includes(search) ||
            cmd.aliases?.some(alias => alias.includes(search))
        );

        if (filtered.length === 0) {
          await interaction.reply({
            content: `No custom commands found matching "${search}".`
          });
          return;
        }
      }

      // Paginate results
      const pageSize = 5;
      const pages: ContainerBuilder[] = [];

      for (let i = 0; i < filtered.length; i += pageSize) {
        const pageCommands = filtered.slice(i, i + pageSize);
        const pageNum = Math.floor(i / pageSize) + 1;
        const totalPages = Math.ceil(filtered.length / pageSize);

        const container = moduleContainer('custom_commands');
        addText(container, `### Custom Commands (${pageNum} of ${totalPages})\nTotal commands: **${commands.length}**`);
        addSeparator(container, 'small');

        const fields = pageCommands.map(cmd => {
          const aliases = cmd.aliases && cmd.aliases.length > 0
            ? `\nAliases: ${cmd.aliases.join(', ')}`
            : '';
          const responsePreview = cmd.response.substring(0, 50).replace(/\n/g, ' ') + (cmd.response.length > 50 ? '...' : '');

          return {
            name: `\`${cmd.name}\``,
            value: `${responsePreview}${aliases}\nUses: ${cmd.useCount || 0} | Cooldown: ${cmd.cooldown || 0}s`,
            inline: false
          };
        });

        addFields(container, fields);
        addText(container, `-# Page ${pageNum} of ${totalPages}`);
        pages.push(container);
      }

      if (pages.length === 1) {
        await interaction.reply(v2Payload(pages));
        return;
      }

      // Create pagination controls
      let currentPage = 0;

      const buildPageWithButtons = (page: number) => {
        const container = pages[page];
        const prevButton = new ButtonBuilder()
          .setCustomId('prev_page')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId('next_page')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pages.length - 1);

        addButtons(container, [prevButton, nextButton]);
        return container;
      };

      const response = await interaction.reply(v2Payload([buildPageWithButtons(currentPage)]));

      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'You cannot interact with this pagination.'
          });
          return;
        }

        if (buttonInteraction.customId === 'next_page') {
          currentPage++;
        } else if (buttonInteraction.customId === 'prev_page') {
          currentPage--;
        }

        await buttonInteraction.update(v2Payload([buildPageWithButtons(currentPage)]));
      });

      collector.on('end', async () => {
        try {
          await response.edit(v2Payload([pages[currentPage]]));
        } catch (error) {
          logger.warn('Failed to remove pagination buttons', error);
        }
      });
    } catch (error) {
      logger.error('Failed to list custom commands', error);
      await interaction.reply({
        content: 'Failed to list custom commands. Please try again later.'
      });
    }
  }
};

export default listCommand;
