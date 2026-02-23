import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { giveaways } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('requirement')
    .setDescription('Manage giveaway entry requirements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('role').setDescription('Require a role to enter')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
        .addRoleOption((opt) => opt.setName('role').setDescription('Required role').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('level').setDescription('Require a minimum level to enter')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
        .addIntegerOption((opt) => opt.setName('level').setDescription('Minimum level').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('messages').setDescription('Require minimum messages to enter')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
        .addIntegerOption((opt) => opt.setName('count').setDescription('Minimum messages').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View requirements for a giveaway')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('clear').setDescription('Clear all requirements for a giveaway')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    ),

  module: 'giveaways',
  permissionPath: 'giveaways.staff.requirement',
  premiumFeature: 'giveaways.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }
    const subcommand = interaction.options.getSubcommand();
    const giveawayId = interaction.options.getInteger('id', true);
    const db = getDb();
    const rows = await db.select().from(giveaways).where(and(eq(giveaways.id, giveawayId), eq(giveaways.guildId, interaction.guildId!)));
    const giveaway = rows[0] as any;
    if (!giveaway) {
      return interaction.reply({ content: `No giveaway found with ID ${giveawayId}.`, ephemeral: true });
    }
    try {
      const reqs = (giveaway.requirements as any) || {};
      switch (subcommand) {
        case 'role': {
          const role = interaction.options.getRole('role', true);
          reqs.requiredRoles = [...(reqs.requiredRoles || []), role.id];
          await db.update(giveaways).set({ requirements: reqs }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: `Added role requirement: ${role.name}`, ephemeral: true });
        }
        case 'level': {
          const level = interaction.options.getInteger('level', true);
          reqs.minLevel = level;
          await db.update(giveaways).set({ requirements: reqs }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: `Set minimum level requirement to ${level}`, ephemeral: true });
        }
        case 'messages': {
          const count = interaction.options.getInteger('count', true);
          reqs.minMessages = count;
          await db.update(giveaways).set({ requirements: reqs }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: `Set minimum messages requirement to ${count}`, ephemeral: true });
        }
        case 'view': {
          const parts: string[] = [];
          if (reqs.requiredRoles?.length) parts.push(`Roles: ${reqs.requiredRoles.map((id: string) => `<@&${id}>`).join(', ')}`);
          if (reqs.minLevel) parts.push(`Min Level: ${reqs.minLevel}`);
          if (reqs.minMessages) parts.push(`Min Messages: ${reqs.minMessages}`);
          return interaction.reply({
            embeds: [{ title: `Requirements - Giveaway #${giveawayId}`, description: parts.length ? parts.join('\n') : 'No requirements set', color: 0x2f3136 }],
            ephemeral: true,
          });
        }
        case 'clear': {
          await db.update(giveaways).set({ requirements: {} }).where(eq(giveaways.id, giveawayId));
          return interaction.reply({ content: 'Cleared all requirements.', ephemeral: true });
        }
      }
    } catch (error) {
      console.error('Error managing requirements:', error);
      return interaction.reply({ content: 'An error occurred while managing requirements.', ephemeral: true });
    }
  },
};

export default command;
