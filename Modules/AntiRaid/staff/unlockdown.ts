import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { endLockdown, isInLockdown, logRaidAction } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload, warningContainer } from '../../../Shared/src/utils/componentsV2';

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
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      const isLocked = await isInLockdown(interaction.guild.id);

      if (!isLocked) {
        const warningCont = warningContainer('Not Locked Down', 'The server is not currently in lockdown mode');
        await interaction.reply(v2Payload([warningCont]));
        return;
      }

      await interaction.deferReply();

      await endLockdown(interaction.guild);
      await logRaidAction(interaction.guild, 'MANUAL_LOCKDOWN_ENDED', { initiator: interaction.user.id });

      const container = moduleContainer('anti_raid');
      addText(container, '### 🔓 Lockdown Ended');
      addText(container, 'Server lockdown has been manually ended');
      addFields(container, [
        { name: 'Effect', value: 'Members can now send messages and join voice channels', inline: false }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('Error in unlockdown command:', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while ending lockdown.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while ending lockdown.' });
      }
    }
  },
};

export default command;
