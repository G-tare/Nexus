import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

/**
 * Owner middleware — checks if the authenticated user is a bot owner.
 * Bot owners are defined by OWNER_IDS in the .env file.
 */
export function ownerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (!config.discord.ownerIds.includes(req.user.id)) {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }

  next();
}
