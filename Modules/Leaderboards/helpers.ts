import { EmbedBuilder } from 'discord.js';

export type LeaderboardType = 'xp' | 'level' | 'currency' | 'messages' | 'invites' | 'voice' | 'reputation' | 'counting';

export interface LeaderboardConfig {
  enabled: boolean;
  defaultType: LeaderboardType;
  entriesPerPage: number;
  showRankCard: boolean;
  enabledTypes: LeaderboardType[];
}

export interface LeaderboardEntry {
  userId: string;
  value: number;
  rank: number;
  username?: string;
}

export interface LeaderboardOptions {
  page?: number;
  limit?: number;
  days?: number;
}

const DEFAULT_CONFIG: LeaderboardConfig = {
  enabled: true,
  defaultType: 'xp',
  entriesPerPage: 10,
  showRankCard: true,
  enabledTypes: ['xp', 'level', 'currency', 'messages', 'invites', 'voice', 'reputation', 'counting']
};

// Mock database function - replace with actual database calls
async function getGuildModuleConfig(guildId: string, module: string): Promise<any> {
  // This would query your config database
  return {};
}

export async function getLeaderboardConfig(guildId: string): Promise<LeaderboardConfig> {
  try {
    const stored = await getGuildModuleConfig(guildId, 'leaderboards');
    return { ...DEFAULT_CONFIG, ...stored };
  } catch (error) {
    return DEFAULT_CONFIG;
  }
}

export async function fetchLeaderboard(
  guildId: string,
  type: LeaderboardType,
  options: LeaderboardOptions = {}
): Promise<LeaderboardEntry[]> {
  const { page = 1, limit = 10, days } = options;
  const offset = (page - 1) * limit;

  try {
    let query: any[] = [];
    const now = new Date();
    const cutoffDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

    switch (type) {
      case 'xp':
      case 'level':
        query = await queryGuildMembers(guildId, 'totalXp', limit, offset, cutoffDate, 'leveling');
        break;
      case 'currency':
        query = await queryGuildMembers(guildId, 'primaryCurrency', limit, offset, cutoffDate, 'currency');
        break;
      case 'messages':
        query = await queryGuildMembers(guildId, 'messageCount', limit, offset, cutoffDate, 'logging');
        break;
      case 'invites':
        query = await queryInviteData(guildId, limit, offset, cutoffDate);
        break;
      case 'voice':
        query = await queryGuildMembers(guildId, 'voiceMinutes', limit, offset, cutoffDate, 'logging');
        break;
      case 'reputation':
        query = await queryGuildMembers(guildId, 'reputation', limit, offset, cutoffDate, 'moderation');
        break;
      case 'counting':
        query = await queryCountingStats(guildId, limit, offset, cutoffDate);
        break;
      default:
        return [];
    }

    return query.map((entry, index) => ({
      userId: entry.userId,
      value: entry.value,
      rank: offset + index + 1,
      username: entry.username
    }));
  } catch (error) {
    console.error(`Error fetching ${type} leaderboard:`, error);
    return [];
  }
}

async function queryGuildMembers(
  guildId: string,
  field: string,
  limit: number,
  offset: number,
  cutoffDate: Date | null,
  module: string
): Promise<any[]> {
  // Mock query - replace with actual database implementation
  // This would query the appropriate module's data
  return [];
}

async function queryInviteData(
  guildId: string,
  limit: number,
  offset: number,
  cutoffDate: Date | null
): Promise<any[]> {
  // Query invite tracker data
  // Support days filter via created_at or similar timestamp
  return [];
}

async function queryCountingStats(
  guildId: string,
  limit: number,
  offset: number,
  cutoffDate: Date | null
): Promise<any[]> {
  // Query counting game stats
  return [];
}

export async function getUserRank(
  guildId: string,
  userId: string,
  type: LeaderboardType,
  days?: number
): Promise<LeaderboardEntry | null> {
  try {
    // Fetch all entries for the user's type to determine rank
    const allEntries = await fetchLeaderboard(guildId, type, { page: 1, limit: 10000, days });
    const userEntry = allEntries.find(e => e.userId === userId);
    return userEntry || null;
  } catch (error) {
    console.error(`Error fetching user rank:`, error);
    return null;
  }
}

export function buildLeaderboardEmbed(
  entries: LeaderboardEntry[],
  type: LeaderboardType,
  guildName: string,
  page: number,
  totalPages: number,
  userRank?: LeaderboardEntry | null,
  days?: number
): EmbedBuilder {
  const { emoji, displayName } = getLeaderboardTypeDisplay(type);
  const medals = ['🥇', '🥈', '🥉'];

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`${emoji} ${displayName} Leaderboard${days ? ` - Last ${days} days` : ''}`);

  if (entries.length === 0) {
    embed.setDescription('No data available for this leaderboard.');
    return embed;
  }

  let description = '';
  entries.forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : `#${entry.rank}`;
    const formattedValue = formatValue(entry.value, type);
    const userMention = entry.username ? `<@${entry.userId}>` : `Unknown User`;
    description += `${medal} ${userMention} - ${formattedValue}\n`;
  });

  if (userRank && !entries.some(e => e.userId === userRank.userId)) {
    description += `\n**Your Rank:** #${userRank.rank} - ${formatValue(userRank.value, type)}`;
  }

  embed.setDescription(description);
  embed.setFooter({
    text: `Page ${page}/${totalPages} • ${guildName}`
  });

  return embed;
}

export function formatValue(value: number, type: LeaderboardType): string {
  switch (type) {
    case 'xp':
    case 'level':
      return `${value.toLocaleString()} XP`;
    case 'currency':
      return `💰 ${value.toLocaleString()}`;
    case 'messages':
      return `${value.toLocaleString()} messages`;
    case 'invites':
      return `${value} invites`;
    case 'voice':
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return `${hours}h ${minutes}m`;
    case 'reputation':
      return `⭐ ${value}`;
    case 'counting':
      return `${value} correct`;
    default:
      return value.toString();
  }
}

export function getLeaderboardTypeDisplay(type: LeaderboardType): { emoji: string; displayName: string } {
  const displays: Record<LeaderboardType, { emoji: string; displayName: string }> = {
    xp: { emoji: '⚡', displayName: 'Experience (XP)' },
    level: { emoji: '📈', displayName: 'Level' },
    currency: { emoji: '💰', displayName: 'Currency' },
    messages: { emoji: '💬', displayName: 'Messages' },
    invites: { emoji: '🎫', displayName: 'Invites' },
    voice: { emoji: '🎧', displayName: 'Voice Time' },
    reputation: { emoji: '⭐', displayName: 'Reputation' },
    counting: { emoji: '🔢', displayName: 'Counting Game' }
  };

  return displays[type] || { emoji: '🏆', displayName: 'Leaderboard' };
}

export function isValidLeaderboardType(type: string): type is LeaderboardType {
  const validTypes: LeaderboardType[] = ['xp', 'level', 'currency', 'messages', 'invites', 'voice', 'reputation', 'counting'];
  return validTypes.includes(type as LeaderboardType);
}
