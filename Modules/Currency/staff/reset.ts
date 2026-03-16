import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer, successContainer, addText, addSeparator, addSectionWithThumbnail } from '../../../Shared/src/utils/componentsV2';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers, transactions } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';

export default {
  data: new SlashCommandBuilder()
    .setName('currency-reset')
    .setDescription('Reset all currency balances to 0 for a user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to reset currency for').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ,

  module: 'currency',
  permissionPath: 'currency.reset',
  premiumFeature: 'currency.single',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user = interaction.options.getUser('user', true);

      await interaction.deferReply();

      const db = getDb();

      // Update all currency balances to 0
      await db
        .update(guildMembers)
        .set({
          coins: 0,
          gems: 0,
          eventTokens: 0,
        })
        .where(and(eq(guildMembers.guildId, interaction.guildId!), eq(guildMembers.userId, user.id)));

      // Log transactions for each currency type
      await db.insert(transactions).values([
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'coins',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'gems',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
        {
          guildId: interaction.guildId!,
          userId: user.id,
          type: 'reset',
          currencyType: 'event_tokens',
          amount: 0,
          balance: 0,
          source: 'admin_reset',
          metadata: { reason: 'Full reset by staff' },
        },
      ]);

      const container = successContainer('Currency Reset');
      addText(container, `**User:** ${user.toString()}`);
      addText(container, `**Action:** All balances set to 0`);
      addSeparator(container);
      addSectionWithThumbnail(container, `${user.username}`, user.displayAvatarURL({ size: 256 }));

      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error('Error in reset command:', error);
      await interaction.editReply({
        components: [errorContainer('Error', 'An error occurred while resetting currency.')],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
} as BotCommand;
