import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
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
      const pages: EmbedBuilder[] = [];

      for (let i = 0; i < filtered.length; i += pageSize) {
        const pageCommands = filtered.slice(i, i + pageSize);
        const embed = new EmbedBuilder()
          .setTitle(`Custom Commands (${i / pageSize + 1} of ${Math.ceil(filtered.length / pageSize)})`)
          .setColor('#2f3136')
          .setDescription(`Total commands: **${commands.length}**`);

        for (const cmd of pageCommands) {
          const aliases = cmd.aliases && cmd.aliases.length > 0
            ? `\nAliases: ${cmd.aliases.join(', ')}`
            : '';

          const responsePreview = cmd.response.substring(0, 50).replace(/\n/g, ' ') + (cmd.response.length > 50 ? '...' : '');

          embed.addFields({
            name: `\`${cmd.name}\``,
            value: `${responsePreview}${aliases}\nUses: ${cmd.useCount || 0} | Cooldown: ${cmd.cooldown || 0}s`,
            inline: false
          });
        }

        embed.setFooter({ text: `Page ${Math.floor(i / pageSize) + 1} of ${Math.ceil(filtered.length / pageSize)}` });
        pages.push(embed);
      }

      if (pages.length === 1) {
        await interaction.reply({
          embeds: pages
        });
        return;
      }

      // Create pagination controls
      let currentPage = 0;

      const generateRow = (page: number) => {
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

        return new ActionRowBuilder<ButtonBuilder>()
          .addComponents(prevButton, nextButton);
      };

      const response = await interaction.reply({
        embeds: [pages[currentPage]],
        components: [generateRow(currentPage)]
      });

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

        await buttonInteraction.update({
          embeds: [pages[currentPage]],
          components: [generateRow(currentPage)]
        });
      });

      collector.on('end', async () => {
        try {
          await response.edit({ components: [] });
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
