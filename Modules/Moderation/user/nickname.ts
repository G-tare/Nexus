import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields } from '../../../Shared/src/utils/componentsV2';
import { ensureGuild, ensureGuildMember } from '../helpers';

export default {
  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.nickname',
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Change a user\'s nickname')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to change nickname for')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('new_name')
        .setDescription('New nickname (leave empty to reset)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({});

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const newName = interaction.options.getString('new_name') || null;

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      const oldNickname = targetMember.displayName;
      await targetMember.setNickname(newName);

      const container = successContainer(`Nickname changed for ${targetUser.tag}`);
      addFields(container, [
        { name: 'Old Nickname', value: oldNickname || '(none)' },
        { name: 'New Nickname', value: newName || '(reset to none)' }
      ]);

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error in nickname command:', error);
      await interaction.editReply({
        components: [errorContainer('An error occurred while changing the nickname')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
} as BotCommand;
