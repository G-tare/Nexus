import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed } from '../../../Shared/src/utils/embed';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrencyConfig, getBalance, balanceEmbed } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.balance',
  premiumFeature: 'currency.single',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('View your currency balance or another user\'s balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view the balance of (defaults to yourself)')
        .setRequired(false)
    ),
  
  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const guildId = interaction.guildId!;

      if (!guildId) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Error')
              .setDescription('This command can only be used in a server.')
          ]
        });
      }

      const balance = await getBalance(guildId, targetUser.id);

      if (!balance) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Error')
              .setDescription(`${targetUser.username} has no currency data yet.`)
          ]
        });
      }

      const config = await getCurrencyConfig(guildId);
      const db = getDb();

      const memberRecord = await db
        .select({ dailyStreak: guildMembers.dailyStreak })
        .from(guildMembers)
        .where(and(
          eq(guildMembers.guildId, guildId),
          eq(guildMembers.userId, targetUser.id)
        ))
        .limit(1);

      const streak = memberRecord[0]?.dailyStreak || 0;

      const embed = balanceEmbed(
        targetUser.id,
        targetUser.username,
        targetUser.displayAvatarURL(),
        balance,
        config,
        streak
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Balance Command Error]', error);
      return interaction.editReply({
        embeds: [
          successEmbed()
            .setColor(Colors.Error)
            .setTitle('Error')
            .setDescription('An error occurred while fetching the balance.')
        ]
      });
    }
  }
};

export default command;
