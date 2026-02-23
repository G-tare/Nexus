import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  Role,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBoardConfig,
  saveBoardConfig,
  Board,
  BoardConfig,
} from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('board-config')
    .setDescription('Configure quote boards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View all boards and their settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new quote board')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Board name').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('emoji').setDescription('Reaction emoji').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target channel for starred messages')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('threshold')
            .setDescription('Minimum reactions to add to board (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a board')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('threshold')
        .setDescription('Set reaction threshold for a board')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('threshold')
            .setDescription('Minimum reactions (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('self-react')
        .setDescription('Toggle whether users can react to their own messages')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Allow self-reactions?')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('nsfw')
        .setDescription('Toggle NSFW channel support')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('enabled')
            .setDescription('Allow NSFW channels?')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore-channel')
        .setDescription('Add or remove ignored channels')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to ignore')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignore-role')
        .setDescription('Add or remove ignored roles')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role to ignore')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Add or remove')
            .setRequired(true)
            .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set embed color for a board')
        .addStringOption((opt) =>
          opt
            .setName('board')
            .setDescription('Board name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Hex color code (e.g., #FFD700)')
            .setRequired(true)
        )
    ),

  module: 'quoteboard',
  permissionPath: 'quoteboard.board-config',

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const config = await getBoardConfig(interaction.guildId!);

    try {
      switch (subcommand) {
        case 'view':
          await handleView(interaction, config);
          break;
        case 'create':
          await handleCreate(interaction, config);
          break;
        case 'delete':
          await handleDelete(interaction, config);
          break;
        case 'threshold':
          await handleThreshold(interaction, config);
          break;
        case 'self-react':
          await handleSelfReact(interaction, config);
          break;
        case 'nsfw':
          await handleNsfw(interaction, config);
          break;
        case 'ignore-channel':
          await handleIgnoreChannel(interaction, config);
          break;
        case 'ignore-role':
          await handleIgnoreRole(interaction, config);
          break;
        case 'color':
          await handleColor(interaction, config);
          break;
      }
    } catch (error) {
      console.error('Error in board-config command:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  },
} as BotCommand;

async function handleView(interaction: ChatInputCommandInteraction, config: BoardConfig): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (config.boards.length === 0) {
    await interaction.editReply('No boards configured yet.');
    return;
  }

  const embeds = config.boards.map((board) => {
    const embed = new EmbedBuilder()
      .setTitle(`${board.emoji} ${board.name}`)
      .setColor(board.color as any)
      .addFields(
        { name: 'ID', value: board.id, inline: true },
        { name: 'Emoji', value: board.emoji, inline: true },
        { name: 'Threshold', value: board.threshold.toString(), inline: true },
        { name: 'Self-React', value: board.selfReact ? 'Yes' : 'No', inline: true },
        { name: 'NSFW Enabled', value: board.nsfw ? 'Yes' : 'No', inline: true },
        {
          name: 'Target Channel',
          value: `<#${board.channelId}>`,
          inline: true,
        }
      );

    if (board.ignoredChannels.length > 0) {
      embed.addFields({
        name: 'Ignored Channels',
        value: board.ignoredChannels.map((id) => `<#${id}>`).join(', '),
        inline: false,
      });
    }

    if (board.ignoredRoles.length > 0) {
      embed.addFields({
        name: 'Ignored Roles',
        value: board.ignoredRoles.map((id) => `<@&${id}>`).join(', '),
        inline: false,
      });
    }

    return embed;
  });

  await interaction.editReply({ embeds });
}

async function handleCreate(interaction: ChatInputCommandInteraction, config: BoardConfig): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (config.boards.length >= 5) {
    await interaction.editReply('Maximum of 5 boards per server reached.');
    return;
  }

  const name = interaction.options.getString('name')!;
  const emoji = interaction.options.getString('emoji')!;
  const channel = interaction.options.getChannel('channel') as TextChannel;
  const threshold = interaction.options.getInteger('threshold') ?? 3;

  if (!channel.isTextBased()) {
    await interaction.editReply('Channel must be a text channel.');
    return;
  }

  // Check emoji doesn't already exist
  if (config.boards.some((b) => b.emoji === emoji)) {
    await interaction.editReply('A board with that emoji already exists.');
    return;
  }

  const newBoard: Board = {
    id: `board-${Date.now()}`,
    name,
    emoji,
    channelId: channel.id,
    threshold,
    selfReact: false,
    nsfw: false,
    ignoredChannels: [],
    ignoredRoles: [],
    color: '#FFD700',
  };

  config.boards.push(newBoard);
  await saveBoardConfig(interaction.guildId!, config);

  const embed = new EmbedBuilder()
    .setTitle('Board Created')
    .setColor('#00FF00')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Emoji', value: emoji, inline: true },
      { name: 'Threshold', value: threshold.toString(), inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction, config: BoardConfig): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('name')!;
  const boardIndex = config.boards.findIndex(
    (b) => b.name.toLowerCase() === boardName.toLowerCase()
  );

  if (boardIndex === -1) {
    await interaction.editReply('Board not found.');
    return;
  }

  const deleted = config.boards.splice(boardIndex, 1)[0];
  await saveBoardConfig(interaction.guildId!, config);

  await interaction.editReply(`Deleted board: **${deleted.name}** ${deleted.emoji}`);
}

async function handleThreshold(
  interaction: ChatInputCommandInteraction,
  config: BoardConfig
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const threshold = interaction.options.getInteger('threshold')!;

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  board.threshold = threshold;
  await saveBoardConfig(interaction.guildId!, config);

  await interaction.editReply(
    `Updated **${board.name}** threshold to **${threshold}** reactions.`
  );
}

async function handleSelfReact(
  interaction: ChatInputCommandInteraction,
  config: BoardConfig
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const enabled = interaction.options.getBoolean('enabled')!;

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  board.selfReact = enabled;
  await saveBoardConfig(interaction.guildId!, config);

  await interaction.editReply(
    `${enabled ? 'Enabled' : 'Disabled'} self-reactions for **${board.name}**.`
  );
}

async function handleNsfw(
  interaction: ChatInputCommandInteraction,
  config: BoardConfig
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const enabled = interaction.options.getBoolean('enabled')!;

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  board.nsfw = enabled;
  await saveBoardConfig(interaction.guildId!, config);

  await interaction.editReply(
    `${enabled ? 'Enabled' : 'Disabled'} NSFW support for **${board.name}**.`
  );
}

async function handleIgnoreChannel(
  interaction: ChatInputCommandInteraction,
  config: BoardConfig
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const channel = interaction.options.getChannel('channel')!;
  const action = interaction.options.getString('action') as 'add' | 'remove';

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  if (action === 'add') {
    if (board.ignoredChannels.includes(channel.id)) {
      await interaction.editReply('Channel is already ignored.');
      return;
    }
    board.ignoredChannels.push(channel.id);
    await saveBoardConfig(interaction.guildId!, config);
    await interaction.editReply(`Added <#${channel.id}> to ignore list for **${board.name}**.`);
  } else {
    const index = board.ignoredChannels.indexOf(channel.id);
    if (index === -1) {
      await interaction.editReply('Channel is not ignored.');
      return;
    }
    board.ignoredChannels.splice(index, 1);
    await saveBoardConfig(interaction.guildId!, config);
    await interaction.editReply(
      `Removed <#${channel.id}> from ignore list for **${board.name}**.`
    );
  }
}

async function handleIgnoreRole(
  interaction: ChatInputCommandInteraction,
  config: BoardConfig
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const role = interaction.options.getRole('role')!;
  const action = interaction.options.getString('action') as 'add' | 'remove';

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  if (action === 'add') {
    if (board.ignoredRoles.includes(role.id)) {
      await interaction.editReply('Role is already ignored.');
      return;
    }
    board.ignoredRoles.push(role.id);
    await saveBoardConfig(interaction.guildId!, config);
    await interaction.editReply(`Added <@&${role.id}> to ignore list for **${board.name}**.`);
  } else {
    const index = board.ignoredRoles.indexOf(role.id);
    if (index === -1) {
      await interaction.editReply('Role is not ignored.');
      return;
    }
    board.ignoredRoles.splice(index, 1);
    await saveBoardConfig(interaction.guildId!, config);
    await interaction.editReply(`Removed <@&${role.id}> from ignore list for **${board.name}**.`);
  }
}

async function handleColor(interaction: ChatInputCommandInteraction, config: BoardConfig): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const boardName = interaction.options.getString('board')!;
  const color = interaction.options.getString('color')!;

  // Validate hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    await interaction.editReply('Invalid hex color. Use format: #RRGGBB');
    return;
  }

  const board = config.boards.find((b) => b.name.toLowerCase() === boardName.toLowerCase());
  if (!board) {
    await interaction.editReply('Board not found.');
    return;
  }

  board.color = color;
  await saveBoardConfig(interaction.guildId!, config);

  await interaction.editReply(
    `Updated **${board.name}** embed color to **${color}**.`
  );
}
