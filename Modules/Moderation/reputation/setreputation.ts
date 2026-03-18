import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { ensureGuild, ensureGuildMember } from '../helpers';
import { getUserRep, setUserRep } from '../../Reputation/helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('setreputation')
    .setDescription('Set a user\'s reputation to an exact value')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to set reputation for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('value')
        .setDescription('The exact reputation value to set (0-200)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.setreputation',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const targetUser = interaction.options.getUser('user', true);
    const value = interaction.options.getInteger('value', true);

    try {
      const guild = interaction.guild!;
      await ensureGuild(guild);
      await ensureGuildMember(guildId, targetUser.id);

      // Get current reputation from the canonical source (reputation_users table)
      const oldReputation = await getUserRep(guildId, targetUser.id);

      // Set reputation via the Reputation module helper (syncs both tables)
      await setUserRep(guildId, targetUser.id, value);

      const embed = successEmbed(
        `Set reputation for ${targetUser.username}\n\n` +
        `**Old Score:** ${oldReputation}\n` +
        `**New Score:** ${value}`
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in setreputation command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while setting reputation')] });
    }
  },
} as BotCommand;
