import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { createRole, enableModule, setChannelPermissions } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('autosetup-moderation')
    .setDescription('Setup moderation role and enable Moderation module')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageChannels),

  module: 'autosetup',
  permissionPath: 'autosetup.setup.moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const guild = interaction.guild!;

      // Create Muted role
      const muteRole = await createRole(guild, 'Muted', '#FF0000');

      if (!muteRole.success) {
        await interaction.editReply({
          content: 'Failed to create Muted role.',
        });
        return;
      }

      // Apply permissions to mute role in all text channels
      let updated = 0;
      for (const channel of guild.channels.cache.values()) {
        if (
          channel.type === ChannelType.GuildText || // Text channel
          channel.type === ChannelType.PublicThread || // Public thread
          channel.type === ChannelType.PrivateThread // Private thread
        ) {
          const success = await setChannelPermissions(channel, muteRole.role!.id, {
            deny: BigInt(PermissionFlagsBits.SendMessages),
          });
          if (success) updated++;
        }
      }

      // Enable moderation module
      await enableModule(guild.id, 'moderation', {
        muteRoleId: muteRole.role?.id,
      });

      const container = moduleContainer('autosetup');
      addText(container, '### ✅ Moderation Setup Complete\nModeration module has been configured');
      addText(container, '**Created Role**\n✅ Muted');
      addText(container, `**Channels Updated**\n${updated} channel(s)`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in autosetup moderation command:', error);
      await interaction.editReply({
        content: 'An error occurred while setting up moderation.',
      });
    }
  },
};

export default command;
