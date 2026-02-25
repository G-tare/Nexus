import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { connectAll } from '../database/connection';
import { createModuleLogger } from '../utils/logger';
import { authRouter } from './routes/auth';
import { guildsRouter } from './routes/guilds';
import { modulesRouter } from './routes/modules';
import { permissionsRouter } from './routes/permissions';
import { usersRouter } from './routes/users';
import { ownerRouter } from './routes/owner';
import { authMiddleware } from './middleware/auth';
import { ownerMiddleware } from './middleware/owner';

const logger = createModuleLogger('API');

const app = express();

// ============================================
// Middleware
// ============================================

app.use(helmet());
app.use(cors({
  origin: [
    config.api.dashboardUrl,
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev
    'tauri://localhost',     // Tauri desktop
    'http://10.0.0.98:3001', // Local network (iOS dev)
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Routes
// ============================================

// Auth routes (login, callback, refresh) — no auth middleware
app.use('/api/auth', authRouter);

// Protected routes — require authentication
app.use('/api/guilds', authMiddleware, guildsRouter);
app.use('/api/modules', authMiddleware, modulesRouter);
app.use('/api/permissions', authMiddleware, permissionsRouter);
app.use('/api/users', authMiddleware, usersRouter);

// Owner routes — require owner status
app.use('/api/owner', authMiddleware, ownerMiddleware, ownerRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('API error', { error: err.message, path: req.path, method: req.method });
  res.status(err.status || 500).json({
    error: config.isDev ? err.message : 'Internal server error',
  });
});

// ============================================
// Start
// ============================================

async function start() {
  try {
    await connectAll();
    logger.info('Database connected');

    app.listen(config.api.port, '0.0.0.0', () => {
      logger.info(`API server running on 0.0.0.0:${config.api.port}`);
    });
  } catch (err: any) {
    logger.error('Failed to start API server', { error: err.message });
    process.exit(1);
  }
}

start();

export default app;
