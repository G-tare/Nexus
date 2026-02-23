import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases, guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';
import { successEmbed } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.clearwarnings',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const guild = interaction.guild!;
    const db = getDb();

    // Deactivate all warnings
    await db.update(modCases)
      .set({ isActive: false })
      .where(
        and(
          eq(modCases.guildId, guild.id),
          eq(modCases.targetId, target.id),
          eq(modCases.action, 'warn'),
          eq(modCases.isActive, true)
        )
      );

    // Reset warn count
    await db.execute(sql`
      UPDATE guild_members SET warn_count = 0
      WHERE guild_id = ${guild.id} AND user_id = ${target.id}
    `);

    await interaction.reply({
      embeds: [successEmbed('Warnings Cleared', `All warnings have been cleared for **${target.tag}**.`)],
    });
  },
};

export default command;
