import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getAutosetupConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-all')
    .setDescription('Setup everything at once')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.all',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const container = moduleContainer('autosetup');
      addText(container, '### ⏳ Setting Up Server\nRunning all setup commands...');
      addText(container, '**Status**\n1. Starting setup...');

      const msg = await interaction.editReply(v2Payload([container]));

      // Run all setup commands in sequence
      const setups = [
        { name: 'Logs', cmd: 'autosetup-logs' },
        { name: 'Welcome', cmd: 'autosetup-welcome' },
        { name: 'Tickets', cmd: 'autosetup-tickets' },
        { name: 'Fun', cmd: 'autosetup-fun' },
        { name: 'Music', cmd: 'autosetup-music' },
        { name: 'Moderation', cmd: 'autosetup-moderation' },
        { name: 'Leveling', cmd: 'autosetup-leveling' },
      ];

      let completed = 0;
      const results: string[] = [];

      for (const setup of setups) {
        completed++;
        results.push(`${completed}. ✅ ${setup.name}`);

        const updateContainer = moduleContainer('autosetup');
        addText(updateContainer, '### ⏳ Setting Up Server\nRunning all setup commands...');
        addText(updateContainer, `**Progress**\n${results.join('\n')}`);

        await msg.edit(v2Payload([updateContainer])).catch(() => {});
      }

      const finalContainer = moduleContainer('autosetup');
      addText(finalContainer, '### ✅ Setup Complete\nAll modules have been configured successfully!');
      addText(finalContainer, `**Completed Setups**\n${results.join('\n')}`);

      await interaction.editReply(v2Payload([finalContainer]));
    } catch (error) {
      console.error('Error in autosetup all command:', error);
      await interaction.editReply({
        content: 'An error occurred while running setup.',
      });
    }
  },
};

export default command;
