import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { ensureGuild, ensureGuildMember, adjustReputation } from '../helpers';
import { getUserRep } from '../../Reputation/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('removereputation')
    .setDescription('Remove reputation points from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remove reputation from')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of reputation to remove (1-50)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(50)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('The reason for removing reputation')
        .setRequired(false)
        .setMaxLength(250)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.removereputation',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const guild = interaction.guild!;
      await ensureGuild(guild);
      await ensureGuildMember(guildId, targetUser.id);

      // Get current reputation from the canonical source (reputation_users table)
      const oldReputation = await getUserRep(guildId, targetUser.id);

      // Adjust reputation using helper (negative amount)
      const newReputation = await adjustReputation(guildId, targetUser.id, -amount, reason, interaction.user.id);

      const embed = successEmbed(
        `Removed ${amount} reputation from ${targetUser.username}\n\n` +
        `**Old Score:** ${oldReputation}\n` +
        `**New Score:** ${newReputation}\n` +
        `**Reason:** ${reason}`
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in removereputation command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while removing reputation')] });
    }
  },
} as BotCommand;
