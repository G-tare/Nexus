import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createChannelWithCategory, createCategory, enableModule, getAutosetupConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-tickets')
    .setDescription('Setup ticket system and enable Tickets module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.tickets',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      // Create ticket category
      const ticketCategory = await createCategory(guild, '🎫 Support Tickets');

      if (!ticketCategory.success) {
        await interaction.editReply({
          content: 'Failed to create ticket category.',
        });
        return;
      }

      // Create ticket panel channel
      const panelChannel = await createChannelWithCategory(
        guild,
        config.categoryName,
        'create-ticket'
      );

      if (!panelChannel.success) {
        await interaction.editReply({
          content: 'Failed to create ticket panel channel.',
        });
        return;
      }

      // Enable tickets module
      await enableModule(guild.id, 'tickets', {
        ticketCategoryId: ticketCategory.category?.id,
        panelChannelId: panelChannel.channel?.id,
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Tickets Setup Complete\nTickets module has been configured');
      addText(container, '**Created Category**\n✅ 🎫 Support Tickets');
      addText(container, `**Panel Channel**\n✅ #${panelChannel.channel?.name}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup tickets command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up tickets.',
      });
    }
  },
};

export default command;
