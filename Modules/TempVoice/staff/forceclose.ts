import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import { getTempVCByChannelId, deleteTempVC, auditLog } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('vcforceclose')
  .setDescription('Force close a temporary voice channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('Temporary voice channel to close')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for closing')
      .setRequired(false)
  );

export const vcforceclose: BotCommand = {
  data: command,
  module: 'tempvoice',
  permissionPath: 'modules.tempvoice.staff.forceclose',
  cooldown: 0,

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply();

      const guild = interaction.guild;
      const user = interaction.user;
      const channel = interaction.options.getChannel('channel');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!guild || !channel) {
        return interaction.editReply('Guild or channel not found.');
      }

      // Check if it's a temp VC
      const tempVC = await getTempVCByChannelId(channel.id);
      if (!tempVC) {
        return interaction.editReply('This is not a temporary voice channel.');
      }

      // Get owner info
      const owner = await guild.members.fetch(tempVC.ownerId).catch(() => null);
      const ownerName = owner?.user.username || 'Unknown User';

      // Delete the channel
      try {
        await (channel as any).delete(`Force closed by staff. Reason: ${reason}`);
      } catch (deleteError) {
        logger.error('[TempVoice] Error deleting channel:', deleteError);
        return interaction.editReply('Failed to delete the channel.');
      }

      // Remove from database
      await deleteTempVC(channel.id);

      await auditLog(guild, 'temp_vc_force_closed', channel.id, user.id, {
        owner: tempVC.ownerId,
        reason,
      });

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Channel Force Closed')
        .setDescription(`Temporary voice channel **${channel.name}** has been force closed.`)
        .addFields(
          { name: 'Channel', value: channel.name || 'Unknown', inline: true },
          { name: 'Owner', value: ownerName, inline: true },
          { name: 'Closed By', value: user.username, inline: true },
          { name: 'Reason', value: reason || 'No reason provided' }
        );

      logger.info('[TempVoice] Staff force closed temp VC:', channel.id, 'reason:', reason);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('[TempVoice] Error executing /vcforceclose command:', error);
      return interaction.editReply('An error occurred while closing the channel.');
    }
  },
};

export default vcforceclose;
