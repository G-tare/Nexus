import { Router, Request, Response } from 'express';
import { moduleConfig } from '../../middleware/moduleConfig';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('ModulesAPI');
const router = Router();

/**
 * GET /api/modules/:guildId
 * Get all module configs for a guild.
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const configs = await moduleConfig.getAllConfigs(req.params.guildId as string);
    res.json(configs);
  } catch (err: any) {
    logger.error('Get modules error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/modules/:guildId/:moduleName
 * Get config for a specific module.
 */
router.get('/:guildId/:moduleName', async (req: Request, res: Response) => {
  try {
    const config = await moduleConfig.getModuleConfig(req.params.guildId as string, req.params.moduleName as string);
    if (!config) {
      res.json({ enabled: false, config: {} });
      return;
    }
    res.json(config);
  } catch (err: any) {
    logger.error('Get module config error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/modules/:guildId/:moduleName/toggle
 * Enable or disable a module.
 */
router.patch('/:guildId/:moduleName/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    await moduleConfig.setEnabled(req.params.guildId as string, req.params.moduleName as string, enabled);
    res.json({ success: true, enabled });
  } catch (err: any) {
    logger.error('Toggle module error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PUT /api/modules/:guildId/:moduleName/config
 * Update module configuration.
 */
router.put('/:guildId/:moduleName/config', async (req: Request, res: Response) => {
  try {
    const { config: newConfig } = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      res.status(400).json({ error: 'config must be an object' });
      return;
    }

    await moduleConfig.updateConfig(req.params.guildId as string, req.params.moduleName as string, newConfig);
    res.json({ success: true });
  } catch (err: any) {
    logger.error('Update module config error', { error: err.message });
    res.status(500).json({ error: 'Internal error' });
  }
});

export { router as modulesRouter };
