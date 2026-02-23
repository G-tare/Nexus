import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
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
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    await ensureGuild(guild);

    const targetUser = interaction.options.getUser('user', true);
    const newName = interaction.options.getString('new_name') || null;

    try {
      await ensureGuildMember(guild.id, targetUser.id);
      const targetMember = await guild.members.fetch(targetUser.id);

      const oldNickname = targetMember.displayName;
      await targetMember.setNickname(newName);

      const embed = successEmbed(`Nickname changed for ${targetUser.tag}`);
      embed.addFields(
        { name: 'Old Nickname', value: oldNickname || '(none)' },
        { name: 'New Nickname', value: newName || '(reset to none)' }
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in nickname command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('An error occurred while changing the nickname')]
      });
    }
  }
} as BotCommand;
