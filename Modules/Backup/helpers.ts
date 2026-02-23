import {
  Guild,
  Role,
  GuildChannel,
  ChannelType,
  PermissionOverwrites,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  OverwriteType,
  EmbedBuilder,
} from 'discord.js';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Backup');

// ============================================
// Config Interface
// ============================================

export interface BackupConfig {
  enabled: boolean;

  // Auto-backup interval in hours (0 = disabled)
  autoBackupInterval: number;

  // Max number of backups per guild
  maxBackups: number;

  // Auto-backup on major changes (role/channel create/delete)
  backupOnChange: boolean;

  // Cooldown between change-triggered backups (minutes)
  changeCooldown: number;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  autoBackupInterval: 0,
  maxBackups: 10,
  backupOnChange: false,
  changeCooldown: 30,
};

// ============================================
// Backup Data Types
// ============================================

export interface BackupSnapshot {
  id: number;
  guildId: string;
  name: string;
  createdBy: string; // 'auto' or user ID
  createdAt: Date;
  size: number; // approximate JSON size in bytes
  components: BackupComponents;
}

export interface BackupComponents {
  serverInfo: ServerInfoSnapshot;
  roles: RoleSnapshot[];
  categories: CategorySnapshot[];
  channels: ChannelSnapshot[];
  emojis: EmojiSnapshot[];
  bots: BotSnapshot[];
  stickers: StickerSnapshot[];
  moduleConfigs: Record<string, any>;
}

export interface ServerInfoSnapshot {
  name: string;
  iconURL: string | null;
  verificationLevel: number;
  defaultMessageNotifications: number;
  explicitContentFilter: number;
  systemChannelName: string | null;
  rulesChannelName: string | null;
  afkChannelName: string | null;
  afkTimeout: number;
  description: string | null;
}

export interface RoleSnapshot {
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string; // bigint as string
  mentionable: boolean;
  isManaged: boolean; // bot/integration roles — skip on restore
}

export interface CategorySnapshot {
  name: string;
  position: number;
  permissionOverwrites: PermissionOverwriteSnapshot[];
}

export interface ChannelSnapshot {
  name: string;
  type: number;
  parentName: string | null; // category name for matching on restore
  position: number;
  topic: string | null;
  nsfw: boolean;
  slowmode: number;
  bitrate: number | null;
  userLimit: number | null;
  permissionOverwrites: PermissionOverwriteSnapshot[];
}

export interface PermissionOverwriteSnapshot {
  type: 'role' | 'member';
  targetName: string; // role name or member ID
  allow: string;
  deny: string;
}

export interface EmojiSnapshot {
  name: string;
  url: string;
  animated: boolean;
}

export interface BotSnapshot {
  name: string;
  id: string;
  discriminator: string;
  avatarURL: string | null;
  roles: string[]; // role names the bot had
  permissions: string; // combined permissions bitfield
  inviteURL: string; // reconstructed OAuth2 invite link
}

export interface StickerSnapshot {
  name: string;
  description: string | null;
  tags: string;
  url: string;
  format: number;
}

// ============================================
// Create Backup Snapshot
// ============================================

/**
 * Create a full backup snapshot of the guild's configuration.
 */
export async function createBackup(guild: Guild, name: string, createdBy: string): Promise<BackupSnapshot | null> {
  const db = getDb();

  // Enforce max backups
  const config = await getBackupConfig(guild.id);
  const existing = await getBackupList(guild.id);
  if (existing.length >= config.maxBackups) {
    // Delete the oldest backup
    const oldest = existing[existing.length - 1];
    await deleteBackup(guild.id, oldest.id);
  }

  // Snapshot server info
  const serverInfo: ServerInfoSnapshot = {
    name: guild.name,
    iconURL: guild.iconURL({ size: 1024 }),
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
    systemChannelName: guild.systemChannel?.name || null,
    rulesChannelName: guild.rulesChannel?.name || null,
    afkChannelName: guild.afkChannel?.name || null,
    afkTimeout: guild.afkTimeout,
    description: guild.description,
  };

  // Snapshot roles (exclude @everyone and managed/bot roles)
  const roles: RoleSnapshot[] = guild.roles.cache
    .filter(r => r.id !== guild.id) // exclude @everyone
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      position: r.position,
      permissions: r.permissions.bitfield.toString(),
      mentionable: r.mentionable,
      isManaged: r.managed,
    }));

  // Snapshot categories
  const categories: CategorySnapshot[] = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      name: c.name,
      position: c.position,
      permissionOverwrites: serializeOverwrites(guild, (c as CategoryChannel).permissionOverwrites.cache),
    }));

  // Snapshot channels (exclude categories — they're separate)
  const channels: ChannelSnapshot[] = guild.channels.cache
    .filter(c => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => (a as any).position - (b as any).position)
    .map(c => {
      const channel = c as GuildChannel;
      const textChannel = c.type === ChannelType.GuildText ? (c as TextChannel) : null;
      const voiceChannel = c.type === ChannelType.GuildVoice ? (c as VoiceChannel) : null;

      return {
        name: channel.name,
        type: channel.type,
        parentName: channel.parent?.name || null,
        position: channel.position,
        topic: textChannel?.topic || null,
        nsfw: textChannel?.nsfw || false,
        slowmode: textChannel?.rateLimitPerUser || 0,
        bitrate: voiceChannel?.bitrate || null,
        userLimit: voiceChannel?.userLimit || null,
        permissionOverwrites: serializeOverwrites(guild, (channel as any).permissionOverwrites.cache),
      };
    });

  // Snapshot emojis
  const emojis: EmojiSnapshot[] = guild.emojis.cache.map(e => ({
    name: e.name || 'unknown',
    url: e.url,
    animated: e.animated || false,
  }));

  // Snapshot stickers
  const stickers: StickerSnapshot[] = guild.stickers.cache.map(s => ({
    name: s.name,
    description: s.description,
    tags: s.tags || '',
    url: s.url,
    format: s.format,
  }));

  // Snapshot bots/apps in the server
  const bots: BotSnapshot[] = guild.members.cache
    .filter(m => m.user.bot)
    .map(m => {
      const botRoleNames = m.roles.cache
        .filter(r => r.id !== guild.id) // exclude @everyone
        .map(r => r.name);

      // Reconstruct an invite URL with the bot's current permissions
      const combinedPerms = m.roles.cache.reduce(
        (acc, r) => acc | r.permissions.bitfield,
        BigInt(0)
      );

      return {
        name: m.user.username,
        id: m.user.id,
        discriminator: m.user.discriminator,
        avatarURL: m.user.displayAvatarURL({ size: 256 }),
        roles: botRoleNames,
        permissions: combinedPerms.toString(),
        inviteURL: `https://discord.com/oauth2/authorize?client_id=${m.user.id}&permissions=${combinedPerms}&scope=bot%20applications.commands`,
      };
    });

  // Snapshot module configs
  let moduleConfigs: Record<string, any> = {};
  try {
    const allConfigs = await moduleConfig.getAllConfigs(guild.id);
    moduleConfigs = allConfigs || {};
  } catch {
    // moduleConfig might not support getAllModuleConfigs — skip
  }

  const components: BackupComponents = {
    serverInfo,
    roles,
    categories,
    channels,
    emojis,
    bots,
    stickers,
    moduleConfigs,
  };

  const jsonData = JSON.stringify(components);
  const size = Buffer.byteLength(jsonData, 'utf-8');

  // Store in database
  const [inserted] = (await db.execute(sql`
    INSERT INTO server_backups (guild_id, name, created_by, created_at, size_bytes, components)
    VALUES (${guild.id}, ${name}, ${createdBy}, NOW(), ${size}, ${jsonData}::jsonb)
    RETURNING id, guild_id as "guildId", name, created_by as "createdBy",
              created_at as "createdAt", size_bytes as "size"
  `) as any).rows || [];

  if (!inserted) return null;

  eventBus.emit('backupCreated' as any, {
    guildId: guild.id,
    backupId: inserted.id,
    name,
    createdBy,
  });

  logger.info('Backup created', {
    guildId: guild.id,
    name,
    roles: roles.length,
    channels: channels.length,
    categories: categories.length,
    emojis: emojis.length,
    size,
  });

  return { ...inserted, components };
}

/**
 * Serialize permission overwrites to a portable format.
 */
function serializeOverwrites(
  guild: Guild,
  overwrites: Map<string, PermissionOverwrites> | any
): PermissionOverwriteSnapshot[] {
  const result: PermissionOverwriteSnapshot[] = [];

  const entries = overwrites instanceof Map ? overwrites : new Map(Object.entries(overwrites));

  for (const [id, overwrite] of entries) {
    const ow = overwrite as PermissionOverwrites;
    let targetName: string;
    let type: 'role' | 'member';

    if (ow.type === OverwriteType.Role) {
      const role = guild.roles.cache.get(id);
      targetName = role?.name || id;
      type = 'role';
    } else {
      targetName = id; // member ID
      type = 'member';
    }

    result.push({
      type,
      targetName,
      allow: ow.allow.bitfield.toString(),
      deny: ow.deny.bitfield.toString(),
    });
  }

  return result;
}

// ============================================
// Restore Backup
// ============================================

export type RestoreComponent = 'roles' | 'channels' | 'settings' | 'emojis' | 'stickers' | 'configs' | 'all';

/**
 * Restore a backup. Can selectively restore components.
 *
 * @param fullSetup — "Universal" mode: wipes the server clean (deletes all existing
 *   channels/roles except defaults) then rebuilds everything from the backup. Designed
 *   for restoring onto a brand-new empty server.
 */
export async function restoreBackup(
  guild: Guild,
  backupId: number,
  components: RestoreComponent[] = ['all'],
  fullSetup: boolean = false
): Promise<{ success: boolean; restored: string[]; errors: string[] }> {
  const db = getDb();

  // Allow cross-guild restore: try the guild's own backups first, then global
  let [row] = (await db.execute(sql`
    SELECT components FROM server_backups
    WHERE id = ${backupId}
  `) as any).rows || [];

  if (!row) return { success: false, restored: [], errors: ['Backup not found'] };

  const backup: BackupComponents = typeof row.components === 'string'
    ? JSON.parse(row.components)
    : row.components;

  const restoreAll = components.includes('all');
  const restored: string[] = [];
  const errors: string[] = [];

  // ===== FULL SETUP MODE: clean the server first =====
  if (fullSetup) {
    // Delete all non-default channels
    let deletedChannels = 0;
    for (const [, channel] of guild.channels.cache) {
      try {
        await channel.delete('Full server restore — clearing existing channels');
        deletedChannels++;
      } catch { /* some channels can't be deleted */ }
    }
    restored.push(`Cleared ${deletedChannels} existing channels`);

    // Delete all non-managed, non-@everyone roles
    let deletedRoles = 0;
    const botHighestRole = guild.members.me?.roles.highest;
    for (const [, role] of guild.roles.cache) {
      if (role.id === guild.id) continue; // @everyone
      if (role.managed) continue; // bot/integration roles
      if (botHighestRole && role.position >= botHighestRole.position) continue; // can't delete higher roles
      try {
        await role.delete('Full server restore — clearing existing roles');
        deletedRoles++;
      } catch { /* skip undeletable roles */ }
    }
    restored.push(`Cleared ${deletedRoles} existing roles`);
  }

  // ===== Restore server settings =====
  if (restoreAll || components.includes('settings')) {
    try {
      const editOptions: any = {
        name: backup.serverInfo.name,
        verificationLevel: backup.serverInfo.verificationLevel,
        defaultMessageNotifications: backup.serverInfo.defaultMessageNotifications,
        explicitContentFilter: backup.serverInfo.explicitContentFilter,
        afkTimeout: backup.serverInfo.afkTimeout as any,
        description: backup.serverInfo.description,
      };

      // Try to restore icon
      if (backup.serverInfo.iconURL) {
        try {
          editOptions.icon = backup.serverInfo.iconURL;
        } catch { /* icon URL might be expired */ }
      }

      await guild.edit(editOptions);
      restored.push('Server settings');
    } catch (err: any) {
      errors.push(`Server settings: ${err.message}`);
    }
  }

  // ===== Restore roles (top-down by position for correct hierarchy) =====
  const roleNameToId = new Map<string, string>(); // for permission overwrite reconstruction

  if (restoreAll || components.includes('roles')) {
    let rolesCreated = 0;
    let rolesSkipped = 0;

    // Sort by position ascending so lower roles are created first
    const sortedRoles = [...backup.roles].sort((a, b) => a.position - b.position);

    for (const roleSnap of sortedRoles) {
      if (roleSnap.isManaged) {
        rolesSkipped++;
        continue;
      }

      // Check if role already exists by name
      const existing = guild.roles.cache.find(r => r.name === roleSnap.name);
      if (existing) {
        roleNameToId.set(roleSnap.name, existing.id);
        continue;
      }

      try {
        const newRole = await guild.roles.create({
          name: roleSnap.name,
          color: roleSnap.color,
          hoist: roleSnap.hoist,
          mentionable: roleSnap.mentionable,
          permissions: BigInt(roleSnap.permissions),
          reason: 'Restored from backup',
        });
        roleNameToId.set(roleSnap.name, newRole.id);
        rolesCreated++;
      } catch (err: any) {
        errors.push(`Role "${roleSnap.name}": ${err.message}`);
      }
    }

    // Map @everyone too
    roleNameToId.set('@everyone', guild.id);

    restored.push(`Roles (${rolesCreated} created, ${rolesSkipped} bot roles skipped)`);
  } else {
    // Still build the role name map for permission overwrites
    for (const [, role] of guild.roles.cache) {
      roleNameToId.set(role.name, role.id);
    }
  }

  // ===== Restore categories first (channels need parents) =====
  if (restoreAll || components.includes('channels')) {
    let catsCreated = 0;
    for (const catSnap of backup.categories) {
      const existing = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === catSnap.name
      );
      if (existing) continue;

      try {
        const overwrites = resolvePermissionOverwrites(catSnap.permissionOverwrites, roleNameToId);
        await guild.channels.create({
          name: catSnap.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason: 'Restored from backup',
        });
        catsCreated++;
      } catch (err: any) {
        errors.push(`Category "${catSnap.name}": ${err.message}`);
      }
    }

    // Restore channels
    let channelsCreated = 0;
    for (const chanSnap of backup.channels) {
      const existing = guild.channels.cache.find(
        c => c.name === chanSnap.name && c.type === chanSnap.type
      );
      if (existing) continue;

      try {
        let parent: string | undefined;
        if (chanSnap.parentName) {
          const cat = guild.channels.cache.find(
            c => c.type === ChannelType.GuildCategory && c.name === chanSnap.parentName
          );
          if (cat) parent = cat.id;
        }

        const overwrites = resolvePermissionOverwrites(chanSnap.permissionOverwrites, roleNameToId);

        const options: any = {
          name: chanSnap.name,
          type: chanSnap.type,
          parent,
          permissionOverwrites: overwrites,
          reason: 'Restored from backup',
        };

        if (chanSnap.topic) options.topic = chanSnap.topic;
        if (chanSnap.nsfw) options.nsfw = chanSnap.nsfw;
        if (chanSnap.slowmode) options.rateLimitPerUser = chanSnap.slowmode;
        if (chanSnap.bitrate) options.bitrate = chanSnap.bitrate;
        if (chanSnap.userLimit) options.userLimit = chanSnap.userLimit;

        await guild.channels.create(options);
        channelsCreated++;
      } catch (err: any) {
        errors.push(`Channel "${chanSnap.name}": ${err.message}`);
      }
    }

    // Set system/rules/AFK channels by name after channels are restored
    if (restoreAll || components.includes('settings')) {
      try {
        const editOptions: any = {};
        if (backup.serverInfo.systemChannelName) {
          const sysChan = guild.channels.cache.find(
            c => c.name === backup.serverInfo.systemChannelName && c.type === ChannelType.GuildText
          );
          if (sysChan) editOptions.systemChannel = sysChan.id;
        }
        if (backup.serverInfo.afkChannelName) {
          const afkChan = guild.channels.cache.find(
            c => c.name === backup.serverInfo.afkChannelName && c.type === ChannelType.GuildVoice
          );
          if (afkChan) editOptions.afkChannel = afkChan.id;
        }
        if (Object.keys(editOptions).length > 0) {
          await guild.edit(editOptions);
        }
      } catch { /* best effort */ }
    }

    restored.push(`Categories (${catsCreated} created), Channels (${channelsCreated} created)`);
  }

  // ===== Restore emojis =====
  if (restoreAll || components.includes('emojis')) {
    let emojisCreated = 0;
    for (const emojiSnap of backup.emojis) {
      const existing = guild.emojis.cache.find(e => e.name === emojiSnap.name);
      if (existing) continue;

      try {
        await guild.emojis.create({
          attachment: emojiSnap.url,
          name: emojiSnap.name,
          reason: 'Restored from backup',
        });
        emojisCreated++;
      } catch (err: any) {
        errors.push(`Emoji "${emojiSnap.name}": ${err.message}`);
      }
    }
    restored.push(`Emojis (${emojisCreated} created)`);
  }

  // ===== Restore stickers =====
  if (restoreAll || components.includes('stickers')) {
    let stickersCreated = 0;
    for (const stickerSnap of backup.stickers || []) {
      const existing = guild.stickers.cache.find(s => s.name === stickerSnap.name);
      if (existing) continue;

      try {
        await guild.stickers.create({
          file: stickerSnap.url,
          name: stickerSnap.name,
          tags: stickerSnap.tags || 'restored',
          description: stickerSnap.description || undefined,
          reason: 'Restored from backup',
        } as any);
        stickersCreated++;
      } catch (err: any) {
        errors.push(`Sticker "${stickerSnap.name}": ${err.message}`);
      }
    }
    if (stickersCreated > 0 || (backup.stickers && backup.stickers.length > 0)) {
      restored.push(`Stickers (${stickersCreated} created)`);
    }
  }

  // ===== Restore module configs =====
  if (restoreAll || components.includes('configs')) {
    let configsRestored = 0;
    for (const [moduleName, config] of Object.entries(backup.moduleConfigs)) {
      try {
        await moduleConfig.setConfig(guild.id, moduleName, config);
        configsRestored++;
      } catch (err: any) {
        errors.push(`Config "${moduleName}": ${err.message}`);
      }
    }
    restored.push(`Module configs (${configsRestored} restored)`);
  }

  // ===== Report bots that need re-adding =====
  if (backup.bots && backup.bots.length > 0) {
    restored.push(`Bots recorded: ${backup.bots.length} (use /backupinfo to see invite links)`);
  }

  return { success: errors.length === 0, restored, errors };
}

/**
 * Resolve stored permission overwrites back to Discord format.
 * Maps role names back to IDs using the roleNameToId map.
 */
function resolvePermissionOverwrites(
  overwrites: PermissionOverwriteSnapshot[],
  roleNameToId: Map<string, string>
): Array<{ id: string; type: any; allow: bigint; deny: bigint }> {
  const result: Array<{ id: string; type: any; allow: bigint; deny: bigint }> = [];

  for (const ow of overwrites) {
    let id: string | undefined;

    if (ow.type === 'role') {
      id = roleNameToId.get(ow.targetName);
    } else {
      id = ow.targetName; // member ID — stays the same
    }

    if (!id) continue; // role doesn't exist yet, skip

    result.push({
      id,
      type: ow.type === 'role' ? OverwriteType.Role : OverwriteType.Member,
      allow: BigInt(ow.allow),
      deny: BigInt(ow.deny),
    });
  }

  return result;
}

// ============================================
// Compare Backup vs Current Server
// ============================================

export interface BackupDiff {
  roles: {
    added: string[];     // exist in server but not backup
    removed: string[];   // exist in backup but not server
    changed: Array<{ name: string; changes: string[] }>;
  };
  channels: {
    added: string[];
    removed: string[];
    changed: Array<{ name: string; changes: string[] }>;
  };
  categories: {
    added: string[];
    removed: string[];
  };
  emojis: {
    added: string[];
    removed: string[];
  };
  bots: {
    added: string[];   // bots now in server that weren't in backup
    removed: string[];  // bots in backup that are gone
  };
  settings: string[]; // list of changed settings
}

/**
 * Compare a backup snapshot against the current server state.
 * Returns a structured diff of what's changed.
 */
export async function compareBackup(guild: Guild, backupId: number): Promise<BackupDiff | null> {
  const db = getDb();
  const [row] = (await db.execute(sql`
    SELECT components FROM server_backups
    WHERE id = ${backupId}
  `) as any).rows || [];

  if (!row) return null;

  const backup: BackupComponents = typeof row.components === 'string'
    ? JSON.parse(row.components)
    : row.components;

  const diff: BackupDiff = {
    roles: { added: [], removed: [], changed: [] },
    channels: { added: [], removed: [], changed: [] },
    categories: { added: [], removed: [] },
    emojis: { added: [], removed: [] },
    bots: { added: [], removed: [] },
    settings: [],
  };

  // ----- Roles -----
  const currentRoleNames = new Set(guild.roles.cache.filter(r => r.id !== guild.id).map(r => r.name));
  const backupRoleNames = new Set(backup.roles.filter(r => !r.isManaged).map(r => r.name));

  for (const name of currentRoleNames) {
    if (!backupRoleNames.has(name)) diff.roles.added.push(name);
  }
  for (const name of backupRoleNames) {
    if (!currentRoleNames.has(name)) diff.roles.removed.push(name);
  }
  // Check for changes in roles that exist in both
  for (const bRole of backup.roles) {
    if (bRole.isManaged) continue;
    const current = guild.roles.cache.find(r => r.name === bRole.name);
    if (!current) continue;

    const changes: string[] = [];
    if (current.color !== bRole.color) changes.push(`color: ${bRole.color} → ${current.color}`);
    if (current.hoist !== bRole.hoist) changes.push(`hoist: ${bRole.hoist} → ${current.hoist}`);
    if (current.mentionable !== bRole.mentionable) changes.push(`mentionable: ${bRole.mentionable} → ${current.mentionable}`);
    if (current.permissions.bitfield.toString() !== bRole.permissions) changes.push('permissions changed');

    if (changes.length > 0) diff.roles.changed.push({ name: bRole.name, changes });
  }

  // ----- Categories -----
  const currentCats = new Set(guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => c.name));
  const backupCats = new Set(backup.categories.map(c => c.name));

  for (const name of currentCats) {
    if (!backupCats.has(name)) diff.categories.added.push(name);
  }
  for (const name of backupCats) {
    if (!currentCats.has(name)) diff.categories.removed.push(name);
  }

  // ----- Channels -----
  const currentChans = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory);
  const backupChanKeys = new Set(backup.channels.map(c => `${c.name}:${c.type}`));
  const currentChanKeys = new Set(currentChans.map(c => `${c.name}:${c.type}`));

  for (const c of currentChans.values()) {
    if (!backupChanKeys.has(`${c.name}:${c.type}`)) diff.channels.added.push(c.name);
  }
  for (const c of backup.channels) {
    if (!currentChanKeys.has(`${c.name}:${c.type}`)) diff.channels.removed.push(c.name);
  }
  // Check for channel property changes
  for (const bChan of backup.channels) {
    const current = currentChans.find(c => c.name === bChan.name && c.type === bChan.type);
    if (!current) continue;

    const changes: string[] = [];
    const textChan = current.type === ChannelType.GuildText ? (current as TextChannel) : null;
    const voiceChan = current.type === ChannelType.GuildVoice ? (current as VoiceChannel) : null;
    const guildChan = current as GuildChannel;

    if (guildChan.parent?.name !== bChan.parentName) changes.push(`category: ${bChan.parentName || 'none'} → ${guildChan.parent?.name || 'none'}`);
    if (textChan && textChan.topic !== bChan.topic) changes.push('topic changed');
    if (textChan && textChan.nsfw !== bChan.nsfw) changes.push(`nsfw: ${bChan.nsfw} → ${textChan.nsfw}`);
    if (textChan && textChan.rateLimitPerUser !== bChan.slowmode) changes.push(`slowmode: ${bChan.slowmode}s → ${textChan.rateLimitPerUser}s`);

    if (changes.length > 0) diff.channels.changed.push({ name: bChan.name, changes });
  }

  // ----- Emojis -----
  const currentEmojis = new Set(guild.emojis.cache.map(e => e.name || ''));
  const backupEmojis = new Set(backup.emojis.map(e => e.name));

  for (const name of currentEmojis) {
    if (name && !backupEmojis.has(name)) diff.emojis.added.push(name);
  }
  for (const name of backupEmojis) {
    if (!currentEmojis.has(name)) diff.emojis.removed.push(name);
  }

  // ----- Bots -----
  const currentBotIds = new Set(guild.members.cache.filter(m => m.user.bot).map(m => m.user.id));
  const backupBotIds = new Set((backup.bots || []).map(b => b.id));

  for (const m of guild.members.cache.filter(m => m.user.bot).values()) {
    if (!backupBotIds.has(m.user.id)) diff.bots.added.push(m.user.username);
  }
  for (const b of backup.bots || []) {
    if (!currentBotIds.has(b.id)) diff.bots.removed.push(b.name);
  }

  // ----- Server Settings -----
  if (guild.name !== backup.serverInfo.name) diff.settings.push(`Name: "${backup.serverInfo.name}" → "${guild.name}"`);
  if (guild.verificationLevel !== backup.serverInfo.verificationLevel) diff.settings.push('Verification level changed');
  if (guild.defaultMessageNotifications !== backup.serverInfo.defaultMessageNotifications) diff.settings.push('Default notifications changed');
  if (guild.explicitContentFilter !== backup.serverInfo.explicitContentFilter) diff.settings.push('Explicit content filter changed');
  if (guild.afkTimeout !== backup.serverInfo.afkTimeout) diff.settings.push(`AFK timeout: ${backup.serverInfo.afkTimeout}s → ${guild.afkTimeout}s`);
  if ((guild.description || null) !== backup.serverInfo.description) diff.settings.push('Description changed');

  return diff;
}

// ============================================
// Backup CRUD
// ============================================

/**
 * Get all backups for a guild (without full component data).
 */
export async function getBackupList(guildId: string): Promise<BackupSnapshot[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT id, guild_id as "guildId", name, created_by as "createdBy",
           created_at as "createdAt", size_bytes as "size"
    FROM server_backups
    WHERE guild_id = ${guildId}
    ORDER BY created_at DESC
  `) as any).rows || [];

  return rows;
}

/**
 * Get a backup's full info including component summary.
 */
export async function getBackupInfo(guildId: string, backupId: number): Promise<{
  backup: BackupSnapshot;
  summary: {
    roles: number;
    channels: number;
    categories: number;
    emojis: number;
    stickers: number;
    bots: number;
    moduleConfigs: number;
  };
  bots: BotSnapshot[];
} | null> {
  const db = getDb();
  const [row] = (await db.execute(sql`
    SELECT id, guild_id as "guildId", name, created_by as "createdBy",
           created_at as "createdAt", size_bytes as "size", components
    FROM server_backups
    WHERE guild_id = ${guildId} AND id = ${backupId}
  `) as any).rows || [];

  if (!row) return null;

  const components: BackupComponents = typeof row.components === 'string'
    ? JSON.parse(row.components)
    : row.components;

  return {
    backup: row,
    bots: components.bots || [],
    summary: {
      roles: components.roles?.length || 0,
      channels: components.channels?.length || 0,
      categories: components.categories?.length || 0,
      emojis: components.emojis?.length || 0,
      stickers: components.stickers?.length || 0,
      bots: components.bots?.length || 0,
      moduleConfigs: Object.keys(components.moduleConfigs || {}).length,
    },
  };
}

/**
 * Delete a backup.
 */
export async function deleteBackup(guildId: string, backupId: number): Promise<boolean> {
  const db = getDb();

  const result = await db.execute(sql`
    DELETE FROM server_backups
    WHERE guild_id = ${guildId} AND id = ${backupId}
  `);

  return true;
}

// ============================================
// Format Helpers
// ============================================

/**
 * Format bytes to human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// Config Helper
// ============================================

export async function getBackupConfig(guildId: string): Promise<BackupConfig> {
  const cfg = await moduleConfig.getModuleConfig<BackupConfig>(guildId, 'backup');
  return { ...DEFAULT_BACKUP_CONFIG, ...(cfg?.config || {}) };
}
