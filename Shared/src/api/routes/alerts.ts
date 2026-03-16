/**
 * Alerts API Routes — Configurable alert rules and history.
 *
 * Endpoints:
 *  GET    /api/owner/alerts           — List all alert rules
 *  POST   /api/owner/alerts           — Create alert rule
 *  PATCH  /api/owner/alerts/:id       — Update alert rule
 *  DELETE /api/owner/alerts/:id       — Delete alert rule
 *  GET    /api/owner/alerts/history   — Past triggered alerts
 */

import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('AlertsAPI');
export const alertsRouter = Router();

/* ── GET / — List all alert rules ── */

alertsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, name, metric_type, operator, threshold,
              webhook_url, discord_channel_id, enabled, created_at
       FROM alert_rules
       ORDER BY created_at DESC`,
    );

    res.json({ rules: result.rows });
  } catch (err: any) {
    logger.error('Failed to list alert rules', { error: err.message });
    res.status(500).json({ error: 'Failed to list alert rules' });
  }
});

/* ── POST / — Create alert rule ── */

alertsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { name, metricType, operator, threshold, webhookUrl, discordChannelId } = req.body as {
      name?: string;
      metricType?: string;
      operator?: string;
      threshold?: number;
      webhookUrl?: string;
      discordChannelId?: string;
    };

    if (!name || !metricType || !operator || threshold === undefined) {
      res.status(400).json({ error: 'name, metricType, operator, and threshold are required' });
      return;
    }

    const validOperators = ['>', '<', '>=', '<=', '=='];
    if (!validOperators.includes(operator)) {
      res.status(400).json({ error: `Invalid operator. Must be one of: ${validOperators.join(', ')}` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO alert_rules (name, metric_type, operator, threshold, webhook_url, discord_channel_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, metricType, operator, threshold, webhookUrl || null, discordChannelId || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to create alert rule', { error: err.message });
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

/* ── PATCH /:id — Update alert rule ── */

alertsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id as string, 10);
    const { name, enabled, threshold, webhookUrl, discordChannelId } = req.body as {
      name?: string;
      enabled?: boolean;
      threshold?: number;
      webhookUrl?: string;
      discordChannelId?: string;
    };

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    const updates: string[] = [];
    const params: (string | number | boolean)[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (enabled !== undefined) { updates.push(`enabled = $${idx++}`); params.push(enabled); }
    if (threshold !== undefined) { updates.push(`threshold = $${idx++}`); params.push(threshold); }
    if (webhookUrl !== undefined) { updates.push(`webhook_url = $${idx++}`); params.push(webhookUrl); }
    if (discordChannelId !== undefined) { updates.push(`discord_channel_id = $${idx++}`); params.push(discordChannelId); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE alert_rules SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    logger.error('Failed to update alert rule', { error: err.message });
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/* ── DELETE /:id — Delete alert rule ── */

alertsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM alert_rules WHERE id = $1 RETURNING id',
      [id],
    );

    if (!result.rows[0]) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error('Failed to delete alert rule', { error: err.message });
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

/* ── GET /history — Past triggered alerts ── */

alertsRouter.get('/history', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const result = await pool.query(
      `SELECT
         ah.id, ah.rule_id, ah.triggered_at, ah.value, ah.message, ah.resolved,
         ar.name as rule_name, ar.metric_type
       FROM alert_history ah
       LEFT JOIN alert_rules ar ON ar.id = ah.rule_id
       ORDER BY ah.triggered_at DESC
       LIMIT $1`,
      [limit],
    );

    res.json({ history: result.rows });
  } catch (err: any) {
    logger.error('Failed to get alert history', { error: err.message });
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});
