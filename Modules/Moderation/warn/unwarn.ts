import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases, guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remove a specific warning from a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('case_id').setDescription('The case number to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.unwarn',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const caseId = interaction.options.getInteger('case_id', true);
    const guild = interaction.guild!;
    const db = getDb();

    // Find the warning
    const [warn] = await db.select()
      .from(modCases)
      .where(
        and(
          eq(modCases.guildId, guild.id),
          eq(modCases.caseNumber, caseId),
          eq(modCases.targetId, target.id),
          eq(modCases.action, 'warn'),
          eq(modCases.isActive, true)
        )
      )
      .limit(1);

    if (!warn) {
      await interaction.reply({
        embeds: [errorEmbed('Not Found', `No active warning with Case #${caseId} found for ${target.tag}.`)],
        ephemeral: true,
      });
      return;
    }

    // Deactivate the warning
    await db.update(modCases)
      .set({ isActive: false })
      .where(eq(modCases.id, warn.id));

    // Decrement warn count
    await db.execute(sql`
      UPDATE guild_members SET warn_count = GREATEST(0, warn_count - 1)
      WHERE guild_id = ${guild.id} AND user_id = ${target.id}
    `);

    await interaction.reply({
      embeds: [successEmbed('Warning Removed', `Case #${caseId} has been removed from **${target.tag}**.`)],
    });
  },
};

export default command;
