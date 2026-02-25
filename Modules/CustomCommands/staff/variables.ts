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
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

interface VariableGroup {
  name: string;
  description: string;
  variables: Array<{ name: string; description: string }>;
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    name: 'User Variables',
    description: 'Information about the user who triggered the command',
    variables: [
      { name: '{user}', description: 'Username of the user' },
      { name: '{user.mention}', description: 'Mention the user (@user)' },
      { name: '{user.id}', description: 'User ID' },
      { name: '{user.name}', description: 'Username' },
      { name: '{user.tag}', description: 'Full user tag (username#0000)' },
      { name: '{user.avatar}', description: 'User avatar URL' },
      { name: '{user.joindate}', description: 'Date user joined server' },
      { name: '{user.createdate}', description: 'Date user created account' }
    ]
  },
  {
    name: 'Server Variables',
    description: 'Information about the server',
    variables: [
      { name: '{server}', description: 'Server name' },
      { name: '{server.name}', description: 'Server name' },
      { name: '{server.id}', description: 'Server ID' },
      { name: '{server.membercount}', description: 'Number of members' },
      { name: '{server.icon}', description: 'Server icon URL' },
      { name: '{server.boosts}', description: 'Number of boosts' }
    ]
  },
  {
    name: 'Channel Variables',
    description: 'Information about the channel',
    variables: [
      { name: '{channel}', description: 'Channel name' },
      { name: '{channel.name}', description: 'Channel name' },
      { name: '{channel.id}', description: 'Channel ID' },
      { name: '{channel.topic}', description: 'Channel topic' },
      { name: '{channel.mention}', description: 'Mention the channel (#channel)' }
    ]
  },
  {
    name: 'Arguments',
    description: 'Arguments passed to the command',
    variables: [
      { name: '{args}', description: 'All arguments joined together' },
      { name: '{args.1}', description: 'First argument' },
      { name: '{args.2}', description: 'Second argument' },
      { name: '{args.N}', description: 'Nth argument (replace N with number)' }
    ]
  },
  {
    name: 'Random Variables',
    description: 'Generate random values',
    variables: [
      { name: '{random.1-100}', description: 'Random number between 1 and 100' },
      { name: '{random.member}', description: 'Random server member' },
      { name: '{random.channel}', description: 'Random channel' },
      { name: '{random.role}', description: 'Random role' }
    ]
  },
  {
    name: 'Time & Date',
    description: 'Current time and date',
    variables: [
      { name: '{time}', description: 'Current local time' },
      { name: '{time.utc}', description: 'Current UTC time' },
      { name: '{date}', description: 'Current local date' },
      { name: '{date.utc}', description: 'Current UTC date' }
    ]
  },
  {
    name: 'Cross-Module Data',
    description: 'Data from other bot modules (if available)',
    variables: [
      { name: '{level}', description: 'User level (requires Levels module)' },
      { name: '{xp}', description: 'User XP (requires Levels module)' },
      { name: '{coins}', description: 'User coins (requires Economy module)' },
      { name: '{reputation}', description: 'User reputation (requires Reputation module)' },
      { name: '{messages}', description: 'User message count (requires Stats module)' }
    ]
  },
  {
    name: 'Advanced Features',
    description: 'Advanced variable processing',
    variables: [
      { name: '{choose:opt1|opt2|opt3}', description: 'Randomly select from options' },
      { name: '{if:condition|then|else}', description: 'Conditional output' },
      { name: '{math:2+2*3}', description: 'Evaluate math expression' }
    ]
  }
];

export const variablesCommand: BotCommand = {
  module: 'customcommands',
  permissionPath: 'customcommands.variables',
  data: new SlashCommandBuilder()
    .setName('cvariables')
    .setDescription('Show available variables for custom commands')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Variable category to view')
        .setRequired(false)
        .addChoices(
          { name: 'User Variables', value: '0' },
          { name: 'Server Variables', value: '1' },
          { name: 'Channel Variables', value: '2' },
          { name: 'Arguments', value: '3' },
          { name: 'Random Variables', value: '4' },
          { name: 'Time & Date', value: '5' },
          { name: 'Cross-Module Data', value: '6' },
          { name: 'Advanced Features', value: '7' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ,

  async execute(interaction: ChatInputCommandInteraction) {
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
      const category = interaction.options.getString('category');

      if (category !== null) {
        // Show specific category
        const index = parseInt(category);
        const group = VARIABLE_GROUPS[index];

        const embed = new EmbedBuilder()
          .setTitle(`${group.name}`)
          .setDescription(group.description)
          .setColor('#2f3136');

        for (const variable of group.variables) {
          embed.addFields({
            name: variable.name,
            value: variable.description,
            inline: true
          });
        }

        embed.setFooter({ text: 'Use these variables in your custom command responses' });

        await interaction.reply({
          embeds: [embed]
        });
        return;
      }

      // Show all categories with pagination
      const pages: EmbedBuilder[] = [];

      for (const group of VARIABLE_GROUPS) {
        const embed = new EmbedBuilder()
          .setTitle(group.name)
          .setDescription(group.description)
          .setColor('#2f3136');

        for (const variable of group.variables) {
          embed.addFields({
            name: variable.name,
            value: variable.description,
            inline: false
          });
        }

        pages.push(embed);
      }

      if (pages.length === 0) {
        await interaction.reply({
          content: 'No variables available.'
        });
        return;
      }

      // Create pagination
      let currentPage = 0;

      const generateRow = (page: number) => {
        const prevButton = new ButtonBuilder()
          .setCustomId('var_prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId('var_next')
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

        if (buttonInteraction.customId === 'var_next') {
          currentPage++;
        } else if (buttonInteraction.customId === 'var_prev') {
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
      logger.error('Failed to show variables', error);
      await interaction.reply({
        content: 'Failed to show variables. Please try again later.'
      });
    }
  }
};

export default variablesCommand;
