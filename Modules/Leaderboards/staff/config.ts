import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getLeaderboardConfig, getLeaderboardTypeDisplay, LeaderboardType, isValidLeaderboardType } from '../helpers';


const command: BotCommand = {
  module: 'leaderboards',
  permissionPath: 'leaderboards.config',
  data: new SlashCommandBuilder()
    .setName('leaderboard-config')
    .setDescription('Configure leaderboard settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View current leaderboard settings')
    )
    .addSubcommand(sub =>
      sub
        .setName('default-type')
        .setDescription('Set the default leaderboard type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Default leaderboard type')
            .setRequired(true)
            .addChoices(
              { name: 'Experience (XP)', value: 'xp' },
              { name: 'Level', value: 'level' },
              { name: 'Currency', value: 'currency' },
              { name: 'Messages', value: 'messages' },
              { name: 'Invites', value: 'invites' },
              { name: 'Voice Time', value: 'voice' },
              { name: 'Reputation', value: 'reputation' },
              { name: 'Counting Game', value: 'counting' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('entries')
        .setDescription('Set entries per page (5-25)')
        .addIntegerOption(option =>
          option
            .setName('count')
            .setDescription('Number of entries per page')
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(25)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('rank-card')
        .setDescription('Toggle showing user\'s rank at bottom of leaderboard')
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable rank card')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle-type')
        .setDescription('Enable or disable a specific leaderboard type')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Leaderboard type')
            .setRequired(true)
            .addChoices(
              { name: 'Experience (XP)', value: 'xp' },
              { name: 'Level', value: 'level' },
              { name: 'Currency', value: 'currency' },
              { name: 'Messages', value: 'messages' },
              { name: 'Invites', value: 'invites' },
              { name: 'Voice Time', value: 'voice' },
              { name: 'Reputation', value: 'reputation' },
              { name: 'Counting Game', value: 'counting' }
            )
        )
        .addBooleanOption(option =>
          option
            .setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }

      // Check permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply('You need the Manage Guild permission to use this command.');
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'view':
          await handleView(interaction, guildId);
          break;
        case 'default-type':
          await handleDefaultType(interaction, guildId);
          break;
        case 'entries':
          await handleEntries(interaction, guildId);
          break;
        case 'rank-card':
          await handleRankCard(interaction, guildId);
          break;
        case 'toggle-type':
          await handleToggleType(interaction, guildId);
          break;
      }
    } catch (error) {
      console.error('Error in leaderboard-config command:', error);
      await interaction.editReply('An error occurred while processing this command.');
    }
  }
};

async function handleView(interaction: ChatInputCommandInteraction, guildId: string) {
  const config = await getLeaderboardConfig(guildId);

  const container = moduleContainer('leaderboards');
  addFields(container, [
    { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
    { name: 'Default Type', value: getLeaderboardTypeDisplay(config.defaultType).displayName, inline: true },
    { name: 'Entries Per Page', value: config.entriesPerPage.toString(), inline: true },
    { name: 'Show Rank Card', value: config.showRankCard ? '✅ Yes' : '❌ No', inline: true },
    {
      name: 'Enabled Types',
      value: config.enabledTypes
        .map(type => `• ${getLeaderboardTypeDisplay(type as LeaderboardType).displayName}`)
        .join('\n'),
      inline: false
    }
  ]);

  await interaction.editReply(v2Payload([container]));
}

async function handleDefaultType(interaction: ChatInputCommandInteraction, guildId: string) {
  const typeStr = interaction.options.getString('type', true);

  if (!isValidLeaderboardType(typeStr)) {
    await interaction.editReply('Invalid leaderboard type.');
    return;
  }

  // Update in database
  await updateLeaderboardConfig(guildId, { defaultType: typeStr });

  const { displayName, emoji } = getLeaderboardTypeDisplay(typeStr as LeaderboardType);
  await interaction.editReply(
    `✅ Default leaderboard type updated to ${emoji} ${displayName}`
  );
}

async function handleEntries(interaction: ChatInputCommandInteraction, guildId: string) {
  const count = interaction.options.getInteger('count', true);

  // Update in database
  await updateLeaderboardConfig(guildId, { entriesPerPage: count });

  await interaction.editReply(`✅ Entries per page updated to ${count}`);
}

async function handleRankCard(interaction: ChatInputCommandInteraction, guildId: string) {
  const enabled = interaction.options.getBoolean('enabled', true);

  // Update in database
  await updateLeaderboardConfig(guildId, { showRankCard: enabled });

  await interaction.editReply(
    `✅ Rank card display ${enabled ? 'enabled' : 'disabled'}`
  );
}

async function handleToggleType(interaction: ChatInputCommandInteraction, guildId: string) {
  const typeStr = interaction.options.getString('type', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  if (!isValidLeaderboardType(typeStr)) {
    await interaction.editReply('Invalid leaderboard type.');
    return;
  }

  const type = typeStr as LeaderboardType;
  const config = await getLeaderboardConfig(guildId);

  let enabledTypes = [...config.enabledTypes];
  if (enabled && !enabledTypes.includes(type)) {
    enabledTypes.push(type);
  } else if (!enabled && enabledTypes.includes(type)) {
    enabledTypes = enabledTypes.filter(t => t !== type);
  }

  // Update in database
  await updateLeaderboardConfig(guildId, { enabledTypes });

  const { displayName, emoji } = getLeaderboardTypeDisplay(type);
  await interaction.editReply(
    `✅ ${emoji} ${displayName} leaderboard has been ${enabled ? 'enabled' : 'disabled'}`
  );
}

async function updateLeaderboardConfig(guildId: string, updates: Partial<any>): Promise<void> {
  // This would update your configuration database
  // Implementation depends on your database structure
  try {
    // Mock implementation - replace with actual database call
    console.log(`Updating leaderboard config for guild ${guildId}:`, updates);
  } catch (error) {
    console.error('Error updating leaderboard config:', error);
    throw error;
  }
}

export default command;
