import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getDb, getRedis } from '../../database/connection';
import { cache } from '../../cache/cacheManager';
import { guilds, guildModuleConfigs, guildMembers, modCases, automodLogs, users } from '../../database/models/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { moduleConfig } from '../../middleware/moduleConfig';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('GuildsAPI');
const router = Router();
const DISCORD_API = 'https://discord.com/api/v10';

// Cache TTL for search-query members (bot-synced members use longer TTL)
const MEMBERS_CACHE_TTL = 120;  // 2 minutes for search queries

// Keep-alive axios instance to reduce TLS handshake overhead
const http = require('http');
const https = require('https');
const discordAxios = axios.create({
  baseURL: DISCORD_API,
  timeout: 15000,
  headers: { Authorization: `Bot ${config.discord.token}` },
  // Keep TCP connections alive with heartbeat to prevent stale sockets
  httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 }),
  httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, rejectUnauthorized: true }),
});

// Helper: check if an error is retryable (network / TLS / timeout)
function isRetryableError(err: any): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  const msg = err.message ?? '';
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' ||
    code === 'EPIPE' || code === 'EAI_AGAIN' ||
    msg.includes('socket hang up') || msg.includes('ECONNREFUSED') ||
    msg.includes('TLS') || msg.includes('disconnected') ||
    msg.includes('network') || msg.includes('timeout');
}

/**
 * POST /api/guilds/check
 * Given a list of guild IDs, returns which ones the bot is active in.
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const guildIds = req.body.guildIds ?? req.body.guild_ids;
    logger.info('Guild check request', {
      bodyKeys: Object.keys(req.body),
      guildIdCount: Array.isArray(guildIds) ? guildIds.length : 'not-array',
      guildIds,
    });

    if (!Array.isArray(guildIds) || guildIds.length === 0) {
      res.json({ activeGuildIds: [], active_guild_ids: [] });
      return;
    }

    const stringIds = guildIds.map((id: any) => String(id));

    const db = getDb();
    const activeGuilds = await db.select({ id: guilds.id })
      .from(guilds)
      .where(
        and(
          eq(guilds.isActive, true),
          inArray(guilds.id, stringIds)
        )!
      );

    const activeIds = activeGuilds.map(g => g.id);
    logger.info('Guild check result', {
      queriedCount: stringIds.length,
      activeFound: activeIds.length,
      activeIds,
    });

    res.json({ activeGuildIds: activeIds, active_guild_ids: activeIds });
  } catch (err: any) {
    logger.error('Check guilds error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/roles
 * Returns all roles for a guild.
 *
 * Primary source: Redis (populated by the bot via gateway events — instant).
 * Fallback: Discord REST API with retry (only if bot hasn't cached yet).
 */
router.get('/:guildId/roles', async (req: Request, res: Response) => {
  const guildId = req.params.guildId as string;
  const cacheKey = `guild_roles:${guildId}`;

  // 1. Read from Redis (bot writes here instantly on role create/update/delete)
  try {
    const redis = getRedis();
    const redisData = await redis.get(cacheKey);
    if (redisData) {
      const parsed = JSON.parse(redisData);
      if (parsed.roles && parsed.roles.length > 0) {
        res.json(parsed);
        return;
      }
    }
  } catch (redisErr: any) {
    logger.warn('Redis read error (roles)', { error: redisErr.message });
  }

  // 2. Fallback: Discord REST API (bot hasn't started yet or Redis was cleared)
  logger.info('Roles cache miss — falling back to Discord API', { guildId });
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await discordAxios.get(`/guilds/${guildId}/roles`);

      const roles = (response.data as any[])
        .filter((r: any) => r.name !== '@everyone')
        .sort((a: any, b: any) => b.position - a.position)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position,
          managed: r.managed ?? false,
        }));

      const result = { roles };
      res.json(result);
      return;
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        logger.warn('Fetch guild roles retry', { attempt: attempt + 1, error: err.message, guildId });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // Everything failed — return empty but don't crash the app
  logger.error('Roles: all sources failed', { guildId });
  res.json({ roles: [], partial: true });
});

/**
 * GET /api/guilds/:guildId/members/search?q=xxx
 * Search guild members.
 *
 * For empty/initial queries: reads from Redis (populated by bot — instant).
 * For search queries: checks Redis cache, falls back to Discord REST API.
 */
router.get('/:guildId/members/search', async (req: Request, res: Response) => {
  const guildId = req.params.guildId as string;
  const query = (req.query.q as string) || '';
  const cacheKey = `guild_members:${guildId}:${query.toLowerCase().trim()}`;

  // 1. Read from cache (bot writes the empty-query key on startup + member events)
  try {
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      // For empty queries, only serve from cache if we actually have members
      if (query.length > 0 || (cached.members && cached.members.length > 0)) {
        res.json(cached);
        return;
      }
    }
  } catch (cacheErr: any) {
    logger.warn('Cache read error (members)', { error: cacheErr.message });
  }

  // 2. Fallback: Discord REST API
  logger.info('Members cache miss — falling back to Discord API', { guildId, query });
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let discordResponse: any;

      if (query.length < 1) {
        discordResponse = await discordAxios.get(`/guilds/${guildId}/members?limit=50`);
      } else {
        discordResponse = await discordAxios.get(
          `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=25`
        );
      }

      const members = (discordResponse.data as any[]).map((m: any) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.nick ?? m.user.global_name ?? m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
          : null,
      }));

      const result = { members };

      // Cache — searches expire in 2 min, empty queries get 10 min (same as bot sync)
      const ttl = query.length > 0 ? MEMBERS_CACHE_TTL : 600;
      try { cache.set(cacheKey, result, ttl); } catch { /* ignore */ }

      res.json(result);
      return;
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        logger.warn('Search guild members retry', { attempt: attempt + 1, error: err.message, guildId });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // Everything failed
  logger.error('Members: all sources failed', { guildId });
  res.json({ members: [], partial: true });
});

/**
 * GET /api/guilds/:guildId/channels
 * Returns all channels for a guild (text, voice, category, etc.).
 *
 * Primary source: Redis (populated by the bot via gateway events — instant).
 * Fallback: Discord REST API with retry.
 */
router.get('/:guildId/channels', async (req: Request, res: Response) => {
  const guildId = req.params.guildId as string;
  const cacheKey = `guild_channels:${guildId}`;

  // 1. Read from Redis (bot writes here instantly on channel create/update/delete)
  try {
    const redis = getRedis();
    const redisData = await redis.get(cacheKey);
    if (redisData) {
      const parsed = JSON.parse(redisData);
      if (parsed.channels && parsed.channels.length > 0) {
        res.json(parsed);
        return;
      }
    }
  } catch (redisErr: any) {
    logger.warn('Redis read error (channels)', { error: redisErr.message });
  }

  // 2. Fallback: Discord REST API (bot hasn't started yet or Redis was cleared)
  logger.info('Channels cache miss — falling back to Discord API', { guildId });
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await discordAxios.get(`/guilds/${guildId}/channels`);

      const channels = (response.data as any[])
        .map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,           // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
          position: ch.position,
          parentId: ch.parent_id || null,
        }))
        .sort((a: any, b: any) => a.position - b.position);

      const result = { channels };
      res.json(result);
      return;
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        logger.warn('Fetch guild channels retry', { attempt: attempt + 1, error: err.message, guildId });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  logger.error('Channels: all sources failed', { guildId });
  res.json({ channels: [], partial: true });
});

/**
 * GET /api/guilds/:guildId
 * Get guild info and module configuration overview.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const db = getDb();

    const [guild] = await db.select()
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const configs = await moduleConfig.getAllConfigs(guildId);

    res.json({ guild, modules: configs });
  } catch (err: any) {
    logger.error('Get guild error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/stats
 * Get guild statistics for dashboard overview.
 */
router.get('/:guildId/stats', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const db = getDb();

    const members = await db.select()
      .from(guildMembers)
      .where(eq(guildMembers.guildId, guildId));

    const stats = {
      totalMembers: members.length,
      totalMessages: members.reduce((sum, m) => sum + Number(m.totalMessages), 0),
      totalVoiceMinutes: members.reduce((sum, m) => sum + Number(m.totalVoiceMinutes), 0),
      averageLevel: members.length > 0
        ? Math.round(members.reduce((sum, m) => sum + m.level, 0) / members.length)
        : 0,
      highestLevel: members.length > 0
        ? Math.max(...members.map(m => m.level))
        : 0,
    };

    res.json(stats);
  } catch (err: any) {
    logger.error('Get guild stats error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/guilds/:guildId/settings
 * Update guild settings (locale, timezone, etc.).
 */
router.patch('/:guildId/settings', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const { locale, timezone: tz } = req.body;
    const db = getDb();

    const updates: Record<string, any> = {};
    if (locale) updates.locale = locale;
    if (tz) updates.timezone = tz;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updates provided' });
      return;
    }

    await db.update(guilds)
      .set(updates)
      .where(eq(guilds.id, guildId));

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Update guild settings error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/modlogs
 * Get moderation case log with pagination and optional action filter.
 */
router.get('/:guildId/modlogs', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const actionFilter = req.query.action as string | undefined;
    const offset = (page - 1) * limit;
    const db = getDb();

    const conditions = [eq(modCases.guildId, guildId)];
    if (actionFilter) {
      conditions.push(eq(modCases.action, actionFilter as any));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(modCases)
      .where(whereClause!);

    const cases = await db.select()
      .from(modCases)
      .where(whereClause!)
      .orderBy(desc(modCases.caseNumber))
      .limit(limit)
      .offset(offset);

    // Resolve usernames from users table first
    const userIds = new Set<string>();
    for (const c of cases) {
      userIds.add(c.targetId);
      userIds.add(c.moderatorId);
    }
    const userIdList = [...userIds];
    const userLookup = new Map<string, string>();
    if (userIdList.length > 0) {
      const userRows = await db.select({ id: users.id, username: users.username, globalName: users.globalName })
        .from(users)
        .where(inArray(users.id, userIdList));
      for (const u of userRows) {
        if (u.globalName || u.username) {
          userLookup.set(u.id, u.globalName || u.username || u.id);
        }
      }
    }

    // For any IDs still missing a display name, try Discord API
    const missingIds = userIdList.filter(id => !userLookup.has(id));
    if (missingIds.length > 0) {
      const fetchPromises = missingIds.slice(0, 30).map(async (userId) => {
        try {
          const memberRes = await discordAxios.get(`/guilds/${guildId}/members/${userId}`);
          const member = memberRes.data;
          const user = member.user;
          const displayName = member.nick || user.global_name || user.username || userId;
          userLookup.set(userId, displayName);

          // Update users table for next time
          await db.update(users)
            .set({ username: user.username, globalName: user.global_name || null, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .catch(() => {});
        } catch {
          // User may have left — try direct user lookup
          try {
            const userRes = await discordAxios.get(`/users/${userId}`);
            const user = userRes.data;
            userLookup.set(userId, user.global_name || user.username || userId);
          } catch {
            // Give up — use the raw ID
          }
        }
      });
      await Promise.allSettled(fetchPromises);
    }

    res.json({
      cases: cases.map(c => ({
        id: c.id,
        guildId: c.guildId,
        caseNumber: c.caseNumber,
        action: c.action,
        userId: c.targetId,
        moderatorId: c.moderatorId,
        reason: c.reason,
        duration: c.duration,
        isActive: c.isActive,
        createdAt: c.createdAt?.toISOString() ?? new Date().toISOString(),
        username: userLookup.get(c.targetId) || null,
        moderatorUsername: userLookup.get(c.moderatorId) || null,
      })),
      page,
      limit,
      total: countResult?.count ?? 0,
    });
  } catch (err: any) {
    logger.error('Get mod logs error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/guilds/:guildId/modlogs/:caseNumber
 * Edit a moderation case (reason field).
 */
router.patch('/:guildId/modlogs/:caseNumber', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const caseNumber = parseInt(req.params.caseNumber as string, 10);
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      res.status(400).json({ error: 'reason is required and must be a non-empty string' });
      return;
    }

    if (reason.length > 1000) {
      res.status(400).json({ error: 'reason must be 1000 characters or less' });
      return;
    }

    if (isNaN(caseNumber) || caseNumber < 1) {
      res.status(400).json({ error: 'Invalid case number' });
      return;
    }

    const db = getDb();

    // Verify case exists and belongs to this guild
    const [existing] = await db.select()
      .from(modCases)
      .where(and(
        eq(modCases.guildId, guildId),
        eq(modCases.caseNumber, caseNumber),
      ))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    // Update reason
    await db.update(modCases)
      .set({ reason: reason.trim() })
      .where(and(
        eq(modCases.guildId, guildId),
        eq(modCases.caseNumber, caseNumber),
      ));

    res.json({ success: true, caseNumber, reason: reason.trim() });
  } catch (err: any) {
    logger.error('Edit mod case error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/automodlogs
 * Get automod action logs with pagination and optional action/violation filter.
 */
router.get('/:guildId/automodlogs', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const actionFilter = req.query.action as string | undefined;
    const violationFilter = req.query.violation as string | undefined;
    const offset = (page - 1) * limit;
    const db = getDb();

    const conditions = [eq(automodLogs.guildId, guildId)];
    if (actionFilter) {
      conditions.push(eq(automodLogs.action, actionFilter as any));
    }
    if (violationFilter) {
      conditions.push(eq(automodLogs.violationType, violationFilter));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(automodLogs)
      .where(whereClause!);

    const logs = await db.select()
      .from(automodLogs)
      .where(whereClause!)
      .orderBy(desc(automodLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Resolve usernames
    const userIds = new Set<string>();
    for (const log of logs) {
      userIds.add(log.targetId);
    }
    const userIdList = [...userIds];
    const userLookup = new Map<string, string>();
    if (userIdList.length > 0) {
      const userRows = await db.select({ id: users.id, username: users.username, globalName: users.globalName })
        .from(users)
        .where(inArray(users.id, userIdList));
      for (const u of userRows) {
        if (u.globalName || u.username) {
          userLookup.set(u.id, u.globalName || u.username || u.id);
        }
      }
    }

    // Discord API fallback for missing usernames
    const missingIds = userIdList.filter(id => !userLookup.has(id));
    if (missingIds.length > 0) {
      const fetchPromises = missingIds.slice(0, 30).map(async (userId) => {
        try {
          const memberRes = await discordAxios.get(`/guilds/${guildId}/members/${userId}`);
          const member = memberRes.data;
          const user = member.user;
          userLookup.set(userId, member.nick || user.global_name || user.username || userId);
        } catch {
          try {
            const userRes = await discordAxios.get(`/users/${userId}`);
            const user = userRes.data;
            userLookup.set(userId, user.global_name || user.username || userId);
          } catch {
            // Use raw ID
          }
        }
      });
      await Promise.allSettled(fetchPromises);
    }

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        guildId: log.guildId,
        targetId: log.targetId,
        action: log.action,
        violationType: log.violationType,
        reason: log.reason,
        messageContent: log.messageContent,
        channelId: log.channelId,
        duration: log.duration,
        createdAt: log.createdAt?.toISOString() ?? new Date().toISOString(),
        username: userLookup.get(log.targetId) || null,
      })),
      page,
      limit,
      total: countResult?.count ?? 0,
    });
  } catch (err: any) {
    logger.error('Get automod logs error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/guilds/:guildId/activity
 * Get aggregated activity data for charts.
 */
router.get('/:guildId/activity', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const period = (req.query.period as string) || '7d';
    const db = getDb();

    const now = new Date();
    let startDate: string;

    switch (period) {
      case '24h': {
        const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startDate = d.toISOString().split('T')[0];
        break;
      }
      case '30d': {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = d.toISOString().split('T')[0];
        break;
      }
      default: {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = d.toISOString().split('T')[0];
        break;
      }
    }

    const result = await db.execute(sql`
      SELECT
        TO_CHAR(date, 'MM/DD') as label,
        date,
        COALESCE(SUM(message_count), 0)::int as messages,
        COALESCE(SUM(voice_minutes), 0)::int as voice_minutes,
        COALESCE(SUM(reaction_count), 0)::int as reactions
      FROM activity_tracking
      WHERE guild_id = ${guildId} AND date >= ${startDate}
      GROUP BY date
      ORDER BY date ASC
    `);

    res.json({
      points: result.rows.map((row: any) => ({
        label: row.label?.trim() ?? '',
        messages: Number(row.messages || 0),
        voiceMinutes: Number(row.voice_minutes || 0),
        reactions: Number(row.reactions || 0),
      })),
      period,
    });
  } catch (err: any) {
    logger.error('Get activity data error', { error: err.message });
    res.json({ points: [], period: req.query.period || '7d' });
  }
});

export { router as guildsRouter };
