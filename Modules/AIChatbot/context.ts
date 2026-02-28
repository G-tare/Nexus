/**
 * Server Context Builder — Snapshots guild state for the AI system prompt.
 *
 * Provides the AI with a structured view of the server so it can make
 * informed decisions about what tools to use.
 */

import { Guild, ChannelType, GuildMember, Client, CategoryChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('AIContext');

// ============================================
// Context Builder
// ============================================

export interface ServerContext {
  serverName: string;
  serverId: string;
  memberCount: number;
  ownerName: string;
  categories: Array<{ name: string; id: string; channels: Array<{ name: string; type: string; id: string }> }>;
  uncategorized: Array<{ name: string; type: string; id: string }>;
  roles: Array<{ name: string; id: string; color: string; memberCount: number; position: number }>;
  botPermissions: string[];
  userPermissions: string[];
  userName: string;
  userRoles: string[];
  enabledModules: string[];
}

const CHANNEL_TYPE_NAMES: Record<number, string> = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildCategory]: 'category',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildStageVoice]: 'stage',
  [ChannelType.GuildForum]: 'forum',
};

/**
 * Build a server context snapshot for the AI system prompt.
 */
export async function buildServerContext(
  guild: Guild,
  member: GuildMember,
  client: Client,
): Promise<ServerContext> {
  // Channels organized by category
  const categories: ServerContext['categories'] = [];
  const uncategorized: ServerContext['uncategorized'] = [];

  const categoryChannels = guild.channels.cache
    .filter((ch): ch is CategoryChannel => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  for (const cat of categoryChannels.values()) {
    const children = guild.channels.cache
      .filter(ch => ch.parentId === cat.id)
      .sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0))
      .map(ch => ({
        name: ch.name,
        type: CHANNEL_TYPE_NAMES[ch.type] ?? 'unknown',
        id: ch.id,
      }));
    categories.push({ name: cat.name, id: cat.id, channels: Array.from(children) });
  }

  // Uncategorized channels
  const orphans = guild.channels.cache
    .filter(ch => !ch.parentId && ch.type !== ChannelType.GuildCategory)
    .sort((a, b) => ('position' in a ? a.position : 0) - ('position' in b ? b.position : 0));
  for (const ch of orphans.values()) {
    uncategorized.push({
      name: ch.name,
      type: CHANNEL_TYPE_NAMES[ch.type] ?? 'unknown',
      id: ch.id,
    });
  }

  // Roles (exclude @everyone, sorted by position desc)
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      name: r.name,
      id: r.id,
      color: r.hexColor,
      memberCount: r.members.size,
      position: r.position,
    }));

  // Bot permissions
  const botMember = guild.members.me;
  const botPerms = botMember?.permissions.toArray() ?? [];

  // User info
  const userPerms = member.permissions.toArray();
  const userRoles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => r.name);

  // Owner name
  let ownerName = 'Unknown';
  try {
    const owner = await guild.fetchOwner();
    ownerName = owner.user.username;
  } catch {
    // Ignore
  }

  // Enabled modules
  const enabledModules: string[] = [];
  const allModules = (client as any).modules as Map<string, { name: string; displayName: string }> | undefined;
  if (allModules) {
    for (const [, mod] of allModules) {
      const enabled = await moduleConfig.isEnabled(guild.id, mod.name);
      if (enabled) enabledModules.push(mod.displayName);
    }
  }

  return {
    serverName: guild.name,
    serverId: guild.id,
    memberCount: guild.memberCount,
    ownerName,
    categories: Array.from(categories),
    uncategorized: Array.from(uncategorized),
    roles: Array.from(roles),
    botPermissions: botPerms,
    userPermissions: userPerms,
    userName: member.user.username,
    userRoles,
    enabledModules,
  };
}

/**
 * Format context into a concise string for the AI system prompt.
 * Keeps it short to save tokens.
 */
export function formatContextForPrompt(ctx: ServerContext): string {
  const lines: string[] = [];

  lines.push(`## Server: ${ctx.serverName} (${ctx.memberCount} members)`);
  lines.push(`Owner: ${ctx.ownerName}`);
  lines.push('');

  // Channels
  lines.push('## Channels');
  for (const cat of ctx.categories) {
    lines.push(`📁 ${cat.name}`);
    for (const ch of cat.channels) {
      lines.push(`  ${ch.type === 'voice' ? '🔊' : '#'} ${ch.name}`);
    }
  }
  if (ctx.uncategorized.length > 0) {
    lines.push('📁 (no category)');
    for (const ch of ctx.uncategorized) {
      lines.push(`  ${ch.type === 'voice' ? '🔊' : '#'} ${ch.name}`);
    }
  }
  lines.push('');

  // Roles (top 20)
  lines.push('## Roles');
  const topRoles = ctx.roles.slice(0, 20);
  for (const r of topRoles) {
    lines.push(`• ${r.name} (${r.memberCount} members)`);
  }
  if (ctx.roles.length > 20) {
    lines.push(`  ... and ${ctx.roles.length - 20} more roles`);
  }
  lines.push('');

  // User info
  lines.push(`## Requesting User: ${ctx.userName}`);
  lines.push(`Roles: ${ctx.userRoles.join(', ') || 'none'}`);
  const isAdmin = ctx.userPermissions.includes('Administrator');
  lines.push(`Permissions: ${isAdmin ? 'Administrator (all)' : ctx.userPermissions.slice(0, 10).join(', ')}`);
  lines.push('');

  // Bot info
  lines.push('## Bot Permissions');
  const botAdmin = ctx.botPermissions.includes('Administrator');
  lines.push(botAdmin ? 'Administrator (all permissions)' : ctx.botPermissions.join(', '));
  lines.push('');

  // Modules
  if (ctx.enabledModules.length > 0) {
    lines.push(`## Enabled Modules: ${ctx.enabledModules.join(', ')}`);
  }

  return lines.join('\n');
}
