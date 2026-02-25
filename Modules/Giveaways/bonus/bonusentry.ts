import {  SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { giveaways } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('bonusentry')
    .setDescription('Manage bonus entries for giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('user').setDescription('Give bonus entries to a specific user')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
        .addUserOption((opt) => opt.setName('user').setDescription('User to give entries to').setRequired(true))
        .addIntegerOption((opt) => opt.setName('entries').setDescription('Number of bonus entries').setRequired(true).setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('role').setDescription('Give bonus entries to a role')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to give entries to').setRequired(true))
        .addIntegerOption((opt) => opt.setName('entries').setDescription('Number of bonus entries').setRequired(true).setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View bonus entries for a giveaway')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('Clear all bonus entries for a giveaway')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    ),

  module: 'giveaways',
  permissionPath: 'giveaways.staff.bonusentry',
  premiumFeature: 'giveaways.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }
    const subcommand = interaction.options.getSubcommand();
    const giveawayId = interaction.options.getInteger('id', true);
    const db = getDb();
    const rows = await db.select().from(giveaways).where(and(eq(giveaways.id, giveawayId), eq(giveaways.guildId, interaction.guildId!)));
    const giveaway = rows[0] as any;
    if (!giveaway) {
      return interaction.reply({ content: `No giveaway found with ID ${giveawayId}.`, flags: MessageFlags.Ephemeral });
    }
    try {
      const reqs = (giveaway.requirements as any) || {};
      const bonusEntries = reqs.bonusEntries ?? {};
      switch (subcommand) {
        case 'user': {
          const user = interaction.options.getUser('user', true);
          const entries = interaction.options.getInteger('entries', true);
          bonusEntries[user.id] = (bonusEntries[user.id] || 0) + entries;
          await db.update(giveaways).set({ requirements: { ...reqs, bonusEntries } }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: `Added ${entries} bonus entries to ${user.username}. Total: ${bonusEntries[user.id]}`, flags: MessageFlags.Ephemeral });
        }
        case 'role': {
          const role = interaction.options.getRole('role', true);
          const entries = interaction.options.getInteger('entries', true);
          bonusEntries[role.id] = (bonusEntries[role.id] || 0) + entries;
          await db.update(giveaways).set({ requirements: { ...reqs, bonusEntries } }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: `Added ${entries} bonus entries to ${role.name}. Total: ${bonusEntries[role.id]}`, flags: MessageFlags.Ephemeral });
        }
        case 'view': {
          const entryList = Object.entries(bonusEntries);
          if (entryList.length === 0) return interaction.reply({ content: 'No bonus entries set.', flags: MessageFlags.Ephemeral });
          const desc = entryList.map(([id, count]) => `${interaction.guild?.roles.cache.has(id) ? `<@&${id}>` : `<@${id}>`}: ${count}`).join('\n');
          return interaction.reply({ embeds: [{ title: `Bonus Entries - Giveaway #${giveawayId}`, description: desc, color: 0x2f3136 }], flags: MessageFlags.Ephemeral });
        }
        case 'clear': {
          delete reqs.bonusEntries;
          await db.update(giveaways).set({ requirements: reqs }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: 'Cleared all bonus entries.', flags: MessageFlags.Ephemeral });
        }
      }
    } catch (error) {
      console.error('Error managing bonus entries:', error);
      return interaction.reply({ content: 'An error occurred while managing bonus entries.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
