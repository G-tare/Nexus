import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { endLockdown, isInLockdown, logRaidAction } from '../helpers';

const logger = createModuleLogger('AntiRaid');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('raid-unlockdown')
    .setDescription('End the current anti-raid server lockdown')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  module: 'antiraid',
  permissionPath: 'antiraid.staff.unlockdown',
  premiumFeature: 'antiraid.protection',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const isLocked = await isInLockdown(interaction.guild.id);

      if (!isLocked) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF9900')
              .setTitle('⚠️ Not Locked Down')
              .setDescription('The server is not currently in lockdown mode')
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      await endLockdown(interaction.guild);
      await logRaidAction(interaction.guild, 'MANUAL_LOCKDOWN_ENDED', { initiator: interaction.user.id });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔓 Lockdown Ended')
            .setDescription('Server lockdown has been manually ended')
            .addFields({ name: 'Effect', value: 'Members can now send messages and join voice channels', inline: false })
            .setFooter({ text: 'AntiRaid System' })
            .setTimestamp(),
        ],
      });
    } catch (error) {
      logger.error('Error in unlockdown command:', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while ending lockdown.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while ending lockdown.', ephemeral: true });
      }
    }
  },
};

export default command;
