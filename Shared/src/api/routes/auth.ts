import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../../config';
import { getDb } from '../../database/connection';
import { users } from '../../database/models/schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('Auth');
const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2';

/**
 * GET /api/auth/login
 * Returns the Discord OAuth2 authorization URL.
 */
router.get('/login', (req: Request, res: Response) => {
  const platform = req.query.platform as string | undefined; // "ios", "android", etc.
  const redirectUri = `${config.api.apiUrl}/api/auth/callback`;
  const scopes = ['identify', 'guilds', 'guilds.members.read'];

  const url = new URL(`${DISCORD_OAUTH_URL}/authorize`);
  url.searchParams.set('client_id', config.discord.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));

  // Pass platform through OAuth state so the callback knows where to redirect
  if (platform) {
    url.searchParams.set('state', platform);
  }

  res.json({ url: url.toString() });
});

/**
 * GET /api/auth/callback?code=xxx
 * Exchange authorization code for access token, then return JWT.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  logger.info('OAuth callback received', { hasCode: !!code, state: req.query.state ?? 'none' });

  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      `${DISCORD_OAUTH_URL}/token`,
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${config.api.apiUrl}/api/auth/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;

    // Upsert user in database
    const db = getDb();
    await db.insert(users).values({
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      avatarUrl: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.webp`
        : null,
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatarUrl: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.webp`
          : null,
        updatedAt: new Date(),
      },
    });

    // Create JWT
    const jwtPayload = {
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      accessToken: access_token,
    };

    const token = jwt.sign(jwtPayload, config.api.jwtSecret, {
      expiresIn: '7d',
    });

    // Check if user is an owner
    const isOwner = config.discord.ownerIds.includes(discordUser.id);

    // Determine where to redirect based on platform (passed via OAuth state)
    const platform = req.query.state as string | undefined;

    if (platform === 'ios') {
      // Redirect to iOS app via custom URL scheme
      // Note: Don't use new URL() for custom schemes — it may not parse them correctly
      const callbackUrl = `nexusbot://callback?token=${encodeURIComponent(token)}&isOwner=${isOwner}`;
      logger.info('Redirecting to iOS app', { url: callbackUrl.substring(0, 50) + '...' });
      res.redirect(callbackUrl);
    } else {
      // Redirect back to web dashboard
      const dashboardUrl = new URL(config.api.dashboardUrl);
      dashboardUrl.pathname = '/auth/callback';
      dashboardUrl.searchParams.set('token', token);
      dashboardUrl.searchParams.set('isOwner', String(isOwner));
      res.redirect(dashboardUrl.toString());
    }
  } catch (err: any) {
    logger.error('OAuth2 callback failed', { error: err.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info from JWT.
 */
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], config.api.jwtSecret) as any;
    const isOwner = config.discord.ownerIds.includes(decoded.id);

    // Try to get fresh user guilds from Discord, but don't fail if Discord API is down
    let guilds: any[] = [];
    try {
      const guildsResponse = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${decoded.accessToken}` },
      });
      guilds = guildsResponse.data;
    } catch (discordErr: any) {
      logger.warn('Failed to fetch guilds from Discord', { error: discordErr.message });
      // Return empty guilds rather than failing the whole auth
    }

    res.json({
      user: {
        id: decoded.id,
        username: decoded.username,
        avatar: decoded.avatar,
        isOwner,
      },
      guilds,
    });
  } catch (err: any) {
    logger.error('Auth /me failed', { error: err.message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export { router as authRouter };
