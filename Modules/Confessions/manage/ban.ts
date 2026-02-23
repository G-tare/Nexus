import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getConfessionConfig,
  banByConfessionId,
  unbanByConfessionId,
  getConfessionData,
} from '../helpers';


const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.confession-ban',
  data: new SlashCommandBuilder()
    .setName('confession-ban')
    .setDescription('Ban or unban users from confessions')
    .addSubcommand(sub =>
      sub
        .setName('ban')
        .setDescription('Ban the author of a confession by ID')
        .addIntegerOption(opt =>
          opt
            .setName('confession-id')
            .setDescription('Confession ID number')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('unban')
        .setDescription('Unban a user by confession ID they were banned from')
        .addIntegerOption(opt =>
          opt
            .setName('confession-id')
            .setDescription('Confession ID number they were originally banned from')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all banned users (by hash)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    const config = await getConfessionConfig(guildId);

    try {
      if (subcommand === 'ban') {
        const confessionId = interaction.options.getInteger('confession-id', true);
        const confessionData = await getConfessionData(guildId, confessionId);

        if (!confessionData) {
          await interaction.reply({
            content: `Confession #${confessionId} not found.`,
            ephemeral: true,
          });
          return;
        }

        const success = await banByConfessionId(guildId, confessionId);
        if (success) {
          await interaction.reply({
            content: `User banned from confessions. They cannot confess again.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: 'Failed to ban user.',
            ephemeral: true,
          });
        }
      } else if (subcommand === 'unban') {
        const confessionId = interaction.options.getInteger('confession-id', true);
        const success = await unbanByConfessionId(guildId, confessionId);

        if (success) {
          await interaction.reply({
            content: `User unbanned from confessions.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `Confession #${confessionId} not found.`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'list') {
        const bannedCount = config.bannedHashes.length;
        if (bannedCount === 0) {
          await interaction.reply({
            content: 'No users are currently banned from confessions.',
            ephemeral: true,
          });
        } else {
          const hashList = config.bannedHashes.map((hash, index) => `${index + 1}. ${hash.substring(0, 8)}...`).join('\n');
          await interaction.reply({
            content: `**Banned Users (${bannedCount}):**\n${hashList}`,
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      console.error('Error in confession ban command:', error);
      await interaction.reply({
        content: 'An error occurred.',
        ephemeral: true,
      });
    }
  },
};

export default command;
