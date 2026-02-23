import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { ensureGuild, ensureGuildMember, adjustReputation } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('addreputation')
    .setDescription('Add reputation points to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to add reputation to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount of reputation to add (1-50)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(50)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('The reason for adding reputation')
        .setRequired(false)
        .setMaxLength(250)
    ),

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.addreputation',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    if (!guildId) return interaction.editReply({ embeds: [errorEmbed('Guild context required')] });

    const db = getDb();
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const guild = interaction.guild!;
      await ensureGuild(guild);
      await ensureGuildMember(guildId, targetUser.id);

      // Get current reputation
      const memberData = await db
        .select()
        .from(guildMembers)
        .where(
          and(
            eq(guildMembers.guildId, guildId),
            eq(guildMembers.userId, targetUser.id)
          )
        )
        .limit(1);

      const oldReputation = memberData[0]?.reputation || 0;

      // Adjust reputation using helper
      const newReputation = await adjustReputation(guildId, targetUser.id, amount);

      const embed = successEmbed(
        `Added ${amount} reputation to ${targetUser.username}\n\n` +
        `**Old Score:** ${oldReputation}\n` +
        `**New Score:** ${newReputation}\n` +
        `**Reason:** ${reason}`
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in addreputation command:', error);
      return interaction.editReply({ embeds: [errorEmbed('An error occurred while adding reputation')] });
    }
  },
} as BotCommand;
