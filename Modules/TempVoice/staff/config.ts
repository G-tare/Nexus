import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getConfig, saveConfig, DEFAULT_CONFIG } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('vcconfig')
  .setDescription('Configure temporary voice channel settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View current configuration')
  )
  .addSubcommand((sub) =>
    sub
      .setName('enable')
      .setDescription('Enable temporary voice channels')
  )
  .addSubcommand((sub) =>
    sub
      .setName('disable')
      .setDescription('Disable temporary voice channels')
  )
  .addSubcommand((sub) =>
    sub
      .setName('creator')
      .setDescription('Set the creator voice channel')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('Voice channel users join to create temp VCs')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildVoice)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('category')
      .setDescription('Set the category for temp voice channels')
      .addChannelOption((option) =>
        option
          .setName('category')
          .setDescription('Category where temp VCs will be created')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildCategory)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('maxvcs')
      .setDescription('Set max temporary VCs per server')
      .addIntegerOption((option) =>
        option
          .setName('count')
          .setDescription('Maximum number of temp VCs allowed')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('cooldown')
      .setDescription('Set creation cooldown')
      .addIntegerOption((option) =>
        option
          .setName('seconds')
          .setDescription('Cooldown between creating temp VCs')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(3600)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('deleteempty')
      .setDescription('Set time before deleting empty channels')
      .addIntegerOption((option) =>
        option
          .setName('seconds')
          .setDescription('Seconds to wait after channel becomes empty')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(3600)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('inactivity')
      .setDescription('Set inactivity timeout')
      .addIntegerOption((option) =>
        option
          .setName('minutes')
          .setDescription('Minutes of no activity before deletion (0 = disabled)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(1440)
      )
  );

export const vcconfig: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice.staff.config',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply('Guild not found.');
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'view':
          return handleView(interaction, guild);
        case 'enable':
          return handleEnable(interaction, guild);
        case 'disable':
          return handleDisable(interaction, guild);
        case 'creator':
          return handleCreator(interaction, guild);
        case 'category':
          return handleCategory(interaction, guild);
        case 'maxvcs':
          return handleMaxVCs(interaction, guild);
        case 'cooldown':
          return handleCooldown(interaction, guild);
        case 'deleteempty':
          return handleDeleteEmpty(interaction, guild);
        case 'inactivity':
          return handleInactivity(interaction, guild);
        default:
          return interaction.editReply('Unknown subcommand.');
      }
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcconfig command:', error);
      return interaction.editReply('An error occurred while executing the command.');
    }
  },
};

async function handleView(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const config = await getConfig(guild);

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Temporary Voice Channel Configuration')
      .addFields(
        { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Creator Channel', value: config.creatorChannelId ? `<#${config.creatorChannelId}>` : 'Not set', inline: true },
        { name: 'Category', value: config.categoryId ? `<#${config.categoryId}>` : 'Not set', inline: true },
        { name: 'Max VCs', value: config.maxVCs.toString(), inline: true },
        { name: 'Cooldown', value: `${config.cooldownSeconds}s`, inline: true },
        { name: 'Delete After Empty', value: `${config.deleteAfterEmpty}s`, inline: true },
        { name: 'Inactivity Timeout', value: config.inactivityTimeout === 0 ? 'Disabled' : `${config.inactivityTimeout}m`, inline: true },
        { name: 'Bitrate', value: `${config.bitrate} bps`, inline: true },
        { name: 'Default User Limit', value: config.defaultUserLimit === 0 ? 'Unlimited' : config.defaultUserLimit.toString(), inline: true },
        { name: 'Name Template', value: config.nameTemplate },
        { name: 'Banned Users', value: config.bannedUsers.length.toString(), inline: true }
      );

    logger.info('[TempVoice] Staff viewed config for guild:', guild.id);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error viewing config:', error);
    return interaction.editReply('An error occurred while retrieving config.');
  }
}

async function handleEnable(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    await saveConfig(guild, { enabled: true });

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('Temporary Voice Channels Enabled');

    logger.info('[TempVoice] Staff enabled temp VCs for guild:', guild.id);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error enabling temp VCs:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleDisable(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    await saveConfig(guild, { enabled: false });

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Temporary Voice Channels Disabled');

    logger.info('[TempVoice] Staff disabled temp VCs for guild:', guild.id);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error disabling temp VCs:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleCreator(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const channel = interaction.options.getChannel('channel');
    if (!channel) {
      return interaction.editReply('Channel not found.');
    }

    await saveConfig(guild, { creatorChannelId: channel.id });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Creator Channel Set')
      .setDescription(`Users will join <#${channel.id}> to create temporary voice channels.`);

    logger.info('[TempVoice] Staff set creator channel for guild:', guild.id);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting creator channel:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleCategory(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const category = interaction.options.getChannel('category');
    if (!category) {
      return interaction.editReply('Category not found.');
    }

    await saveConfig(guild, { categoryId: category.id });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Category Set')
      .setDescription(`Temporary voice channels will be created in <#${category.id}>.`);

    logger.info('[TempVoice] Staff set category for guild:', guild.id);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting category:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleMaxVCs(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const count = interaction.options.getInteger('count');
    if (count === null) {
      return interaction.editReply('Invalid count.');
    }

    await saveConfig(guild, { maxVCs: count });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Max VCs Updated')
      .setDescription(`Maximum temporary voice channels set to **${count}**.`);

    logger.info('[TempVoice] Staff set max VCs for guild:', guild.id, 'count:', count);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting max VCs:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleCooldown(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const seconds = interaction.options.getInteger('seconds');
    if (seconds === null) {
      return interaction.editReply('Invalid seconds.');
    }

    await saveConfig(guild, { cooldownSeconds: seconds });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Cooldown Updated')
      .setDescription(`Creation cooldown set to **${seconds}** seconds.`);

    logger.info('[TempVoice] Staff set cooldown for guild:', guild.id, 'seconds:', seconds);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting cooldown:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleDeleteEmpty(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const seconds = interaction.options.getInteger('seconds');
    if (seconds === null) {
      return interaction.editReply('Invalid seconds.');
    }

    await saveConfig(guild, { deleteAfterEmpty: seconds });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Delete After Empty Updated')
      .setDescription(`Empty channels will be deleted after **${seconds}** seconds.`);

    logger.info('[TempVoice] Staff set delete after empty for guild:', guild.id, 'seconds:', seconds);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting delete after empty:', error);
    return interaction.editReply('An error occurred.');
  }
}

async function handleInactivity(
  interaction: ChatInputCommandInteraction,
  guild: any
): Promise<any> {
  try {
    const minutes = interaction.options.getInteger('minutes');
    if (minutes === null) {
      return interaction.editReply('Invalid minutes.');
    }

    await saveConfig(guild, { inactivityTimeout: minutes });

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Inactivity Timeout Updated')
      .setDescription(`Inactivity timeout set to **${minutes === 0 ? 'disabled' : minutes + ' minutes'}**.`);

    logger.info('[TempVoice] Staff set inactivity timeout for guild:', guild.id, 'minutes:', minutes);
    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[TempVoice] Error setting inactivity timeout:', error);
    return interaction.editReply('An error occurred.');
  }
}

export default vcconfig;
