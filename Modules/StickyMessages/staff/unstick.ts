import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('StickyMessages');
import { StickyMessagesHelper } from '../helpers';
import type { BotCommand } from '../../../Shared/src/types/command';


const unstickCommand: BotCommand = {
  module: 'stickymessages',
  permissionPath: 'staff.stickymessages.unstick',
  data: new SlashCommandBuilder()
    .setName('unstick')
    .setDescription('Remove a sticky message from a channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to remove the sticky from')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('index')
        .setDescription('Which sticky to remove (1 = highest priority)')
        .setMinValue(1)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: any, db: any) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel', true);
      const index = (interaction.options.getInteger('index') || 1) - 1;

      // Get stickies in this channel
      const helper = new StickyMessagesHelper(db);
      const stickies = await helper.getStickyMessagesByChannel(channel.id);

      if (stickies.length === 0) {
        await interaction.editReply({
          content: 'There are no sticky messages in that channel.',
        });
        return;
      }

      if (index < 0 || index >= stickies.length) {
        await interaction.editReply({
          content: `Invalid index. There are only ${stickies.length} sticky message(s).`,
        });
        return;
      }

      const sticky = stickies[index];

      // Delete the sticky message if it exists
      if (sticky.currentMessageId && channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(sticky.currentMessageId);
          await message.delete();
          logger.debug(`Deleted sticky message ${sticky.currentMessageId}`);
        } catch (error) {
          logger.debug(`Failed to delete sticky message: ${error}`);
        }
      }

      // Remove from database
      await helper.deleteStickyMessage(sticky.id);

      logger.info(
        `Removed sticky message ${sticky.id} from channel ${channel.id}`
      );

      await interaction.editReply({
        content: 'Sticky message removed successfully.',
      });

      // Emit audit log event
      if (interaction.client.emit) {
        interaction.client.emit('auditLog', {
          type: 'STICKY_REMOVED',
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          details: {
            stickyId: sticky.id,
            channelId: channel.id,
          },
        });
      }
    } catch (error) {
      logger.error(`Error in unstick command: ${error}`);
      await interaction.editReply({
        content: 'An error occurred while removing the sticky message.',
      });
    }
  },
};

export default unstickCommand;
