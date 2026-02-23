import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { getAntiRaidConfig, getJoinVelocity, isInLockdown, checkRaidCondition } from '../helpers';

const logger = createModuleLogger('AntiRaid');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('raidstatus')
    .setDescription('View the current raid detection status')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  module: 'antiraid',
  permissionPath: 'antiraid.staff.raidstatus',
  premiumFeature: 'antiraid.protection',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const guildId = interaction.guildId!;
      const config = await getAntiRaidConfig(guildId);
      const velocity = await getJoinVelocity(guildId);
      const raidCheck = await checkRaidCondition(guildId);
      const isLocked = await isInLockdown(guildId);

      const embed = new EmbedBuilder()
        .setColor(isLocked ? '#FF0000' : raidCheck.isRaid ? '#FF9900' : '#00FF00')
        .setTitle('📊 Raid Detection Status')
        .setDescription(`Real-time raid monitoring for ${interaction.guild.name}`)
        .addFields(
          { name: 'System Status', value: config.enabled ? '✅ Active' : '❌ Inactive', inline: true },
          { name: 'Lockdown Status', value: isLocked ? '🔒 Active' : '🔓 Inactive', inline: true },
          { name: 'Raid Detected', value: raidCheck.isRaid ? '⚠️ YES' : '✅ NO', inline: true },
          { name: 'Recent Joins (window)', value: `${velocity.totalJoins} / ${config.joinThreshold}`, inline: true },
          { name: 'New Account Joins', value: `${velocity.newAccountJoins}`, inline: true },
          { name: 'Join Window', value: `${config.joinWindow}s`, inline: true },
          { name: 'Min Account Age', value: `${config.minAccountAge}h`, inline: true },
          { name: 'Lockdown Duration', value: `${config.lockdownDuration}s`, inline: true },
          { name: 'Response Action', value: config.action.toUpperCase(), inline: true }
        )
        .setFooter({ text: 'AntiRaid System' })
        .setTimestamp();

      if (raidCheck.isRaid) {
        embed.addFields({
          name: '⚠️ Action Required',
          value: 'Raid detected! Consider running `/lockdown` if auto-lockdown is disabled.',
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in raidstatus command:', error);
      await interaction.reply({ content: '❌ An error occurred while fetching raid status.', ephemeral: true });
    }
  },
};

export default command;
