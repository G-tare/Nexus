import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { triggerLockdown, isInLockdown, logRaidAction } from '../helpers';

const logger = createModuleLogger('AntiRaid');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('raid-lockdown')
    .setDescription('Manually trigger an anti-raid server lockdown')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt.setName('duration').setDescription('Lockdown duration in seconds (default: 3600)').setMinValue(60).setMaxValue(86400).setRequired(false)
    ),

  module: 'antiraid',
  permissionPath: 'antiraid.staff.lockdown',
  premiumFeature: 'antiraid.protection',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      const duration = interaction.options.getInteger('duration') || 3600;
      const alreadyLocked = await isInLockdown(interaction.guild.id);

      if (alreadyLocked) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF9900')
              .setTitle('⚠️ Already Locked Down')
              .setDescription('The server is already in lockdown mode')
              .addFields({ name: 'Tip', value: 'Use `/unlockdown` to end the current lockdown' })
              .setTimestamp(),
          ],
        });
        return;
      }

      await interaction.deferReply();

      await triggerLockdown(interaction.guild, duration);
      await logRaidAction(interaction.guild, 'MANUAL_LOCKDOWN_TRIGGERED', { initiator: interaction.user.id, duration });

      const durationMinutes = Math.floor(duration / 60);
      const durationSeconds = duration % 60;
      let durationText = '';
      if (durationMinutes > 0) durationText += `${durationMinutes}m`;
      if (durationSeconds > 0) durationText += `${durationSeconds}s`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔒 Lockdown Activated')
            .setDescription('Server lockdown has been manually triggered')
            .addFields(
              { name: 'Duration', value: durationText || `${duration}s`, inline: true },
              { name: 'Expires', value: `<t:${Math.floor(Date.now() / 1000) + duration}:R>`, inline: true },
              { name: 'Effect', value: 'Members cannot send messages or join voice channels', inline: false }
            )
            .setFooter({ text: 'AntiRaid System' })
            .setTimestamp(),
        ],
      });
    } catch (error) {
      logger.error('Error in lockdown command:', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while triggering lockdown.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while triggering lockdown.' });
      }
    }
  },
};

export default command;
