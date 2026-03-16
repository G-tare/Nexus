import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createChannelWithCategory, createRole, enableModule, getAutosetupConfig } from '../helpers';

const LEVEL_COLORS = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF'];

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-leveling')
    .setDescription('Setup leveling system and enable Leveling module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.leveling',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;
      const config = await getAutosetupConfig(guild.id);

      // Create level-up announcement channel
      const levelUpChannel = await createChannelWithCategory(
        guild,
        config.categoryName,
        'level-up'
      );

      // Create level roles
      const levels = [5, 10, 25, 50, 100];
      const createdRoles = [];

      for (let i = 0; i < levels.length; i++) {
        const roleResult = await createRole(
          guild,
          `Level ${levels[i]}`,
          LEVEL_COLORS[i] as any
        );
        if (roleResult.success) {
          createdRoles.push(`✅ Level ${levels[i]}`);
        }
      }

      // Enable leveling module
      await enableModule(guild.id, 'leveling', {
        levelUpChannelId: levelUpChannel.channel?.id,
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Leveling Setup Complete\nLeveling module has been configured');
      addText(container, `**Announcement Channel**\n✅ #${levelUpChannel.channel?.name}`);
      addText(container, `**Level Roles Created**\n${createdRoles.join('\n') || 'Some roles already exist'}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup leveling command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up leveling.',
      });
    }
  },
};

export default command;
