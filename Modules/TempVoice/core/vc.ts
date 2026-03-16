import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import {
  getConfig,
  getUserTempVC,
  isUserBanned,
  getCooldownRemaining,
  createTempVC,
  formatChannelName,
  setCooldown,
  auditLog,
  scheduleInactivityTimeout,
  getGuildTempVCs,
} from '../helpers';
import { moduleContainer, addText, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Create a temporary voice channel');

export const vc: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guild = interaction.guild;
      const user = interaction.user;
      const member = interaction.member;

      if (!guild || !user || !member) {
        return interaction.editReply('Guild, user, or member not found.');
      }

      const config = await getConfig(guild);

      // Check if module is enabled
      if (!config.enabled) {
        return interaction.editReply('Temp voice channels are disabled.');
      }

      // Check if creator channel is configured
      if (!config.creatorChannelId) {
        return interaction.editReply('Temp voice channel creation is not configured.');
      }

      // Check if user is banned
      if (await isUserBanned(guild, user.id)) {
        return interaction.editReply('You are banned from creating temporary voice channels.');
      }

      // Check cooldown
      const cooldownRemaining = getCooldownRemaining(user.id);
      if (cooldownRemaining > 0) {
        return interaction.editReply(
          `You can create a new temp voice channel in **${cooldownRemaining}** seconds.`
        );
      }

      // Check if user already has a temp VC
      const existingVC = await getUserTempVC(guild.id, user.id);
      if (existingVC) {
        return interaction.editReply('You already have an active temporary voice channel. Please delete it first.');
      }

      // Check max temp VCs in guild
      const guildVCs = await getGuildTempVCs(guild.id);
      if (guildVCs.length >= config.maxVCs) {
        return interaction.editReply(`Maximum temporary voice channels (${config.maxVCs}) reached for this server.`);
      }

      // Create new temp VC
      const newChannelName = formatChannelName(config.nameTemplate, user);
      const category = guild.channels.cache.get(config.categoryId || '');
      const isCategory = category && category.type === ChannelType.GuildCategory;

      const newChannel = await guild.channels.create({
        name: newChannelName,
        type: ChannelType.GuildVoice,
        parent: isCategory ? (category as any) : undefined,
        bitrate: config.bitrate,
        userLimit: config.defaultUserLimit || 0,
      });

      // Move user to new channel
      if ((member as any).voice?.channel) {
        await (member as any).voice.setChannel(newChannel);
      }

      // Create database record
      await createTempVC({
        id: `${guild.id}-${newChannel.id}`,
        guildId: guild.id,
        channelId: newChannel.id,
        ownerId: user.id,
        createdAt: new Date(),
        lockedBy: [],
        permittedUsers: [],
        deniedUsers: [],
      });

      // Set cooldown
      setCooldown(user.id, config.cooldownSeconds);

      // Start inactivity timer if configured
      if (config.inactivityTimeout > 0) {
        scheduleInactivityTimeout(
          newChannel.id,
          config.inactivityTimeout * 60 * 1000,
          async () => {
            try {
              logger.info('[TempVoice] Inactivity timeout for channel:', newChannel.id);
              await newChannel.delete('Inactivity timeout');
              await auditLog(guild, 'inactivity_delete', newChannel.id, 'system');
            } catch (error) {
              logger.error('[TempVoice] Error deleting inactive channel:', error);
            }
          }
        );
      }

      await auditLog(guild, 'temp_vc_created', newChannel.id, user.id, {
        name: newChannelName,
      });

      const container = moduleContainer('temp_voice')
        .setAccentColor(0x00ff00);

      addText(container, '### ✅ Temporary Voice Channel Created\nSuccessfully created **' + newChannelName + '**');
      addFields(container, [
        { name: 'Channel', value: `<#${newChannel.id}>`, inline: true },
        { name: 'Owner', value: user.username, inline: true }
      ]);
      addFooter(container, 'Use /vcname, /vclimit, /vclock, /vcpermit, /vckick, /vcinfo to manage your channel.');

      logger.info('[TempVoice] User created temp VC:', newChannel.id, 'user:', user.id);
      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('[TempVoice] Error executing /vc command:', error);
      return interaction.editReply('An error occurred while creating the temporary voice channel.');
    }
  },
};

export default vc;
