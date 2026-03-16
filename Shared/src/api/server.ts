import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { connectAll } from '../database/connection';
import { createModuleLogger } from '../utils/logger';
import { authRouter } from './routes/auth';
import { guildsRouter } from './routes/guilds';
import { modulesRouter } from './routes/modules';
import { permissionsRouter } from './routes/permissions';
import { managersRouter } from './routes/managers';
import { usersRouter } from './routes/users';
import { ownerRouter } from './routes/owner';
import { botTicketsRouter } from './routes/botTickets';
import { commandUsageRouter } from './routes/commandUsage';
import { staffRouter } from './routes/staff';
import { moduleTogglesRouter } from './routes/moduleToggles';
import { healthRouter } from './routes/health';
import { revenueRouter } from './routes/revenue';
import { moderationRouter } from './routes/moderation';
import { alertsRouter } from './routes/alerts';
import { infrastructureRouter } from './routes/infrastructure';
import { serverManagementRouter } from './routes/serverManagement';
import { authMiddleware } from './middleware/auth';
import { ownerMiddleware } from './middleware/owner';
import { seedOwnerStaff } from './middleware/staffAuth';
import { socketManager } from '../websocket/socketManager';

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
    'http://localhost:3002', // Web dashboard dev
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
app.use('/api/managers', authMiddleware, managersRouter);
app.use('/api/users', authMiddleware, usersRouter);

// Owner routes — require owner status
app.use('/api/owner', authMiddleware, ownerMiddleware, ownerRouter);
app.use('/api/owner/tickets', authMiddleware, ownerMiddleware, botTicketsRouter);
app.use('/api/owner/commands', authMiddleware, ownerMiddleware, commandUsageRouter);
app.use('/api/owner/staff', authMiddleware, ownerMiddleware, staffRouter);
app.use('/api/owner', authMiddleware, ownerMiddleware, moduleTogglesRouter);
app.use('/api/owner/health', authMiddleware, ownerMiddleware, healthRouter);
app.use('/api/owner/revenue', authMiddleware, ownerMiddleware, revenueRouter);
app.use('/api/owner/moderation', authMiddleware, ownerMiddleware, moderationRouter);
app.use('/api/owner/alerts', authMiddleware, ownerMiddleware, alertsRouter);
app.use('/api/owner/infrastructure', authMiddleware, ownerMiddleware, infrastructureRouter);
app.use('/api/owner', authMiddleware, ownerMiddleware, infrastructureRouter);
app.use('/api/owner/servers', authMiddleware, ownerMiddleware, serverManagementRouter);

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

// Create HTTP server from Express app (needed for WebSocket upgrade)
const server = createServer(app);

// Attach WebSocket manager to the HTTP server
socketManager.attach(server);

async function start() {
  try {
    await connectAll();
    logger.info('Database connected');

    // Seed OWNER_IDS into bot_staff table with owner role
    await seedOwnerStaff();

    server.listen(config.api.port, '0.0.0.0', () => {
      logger.info(`API server running on 0.0.0.0:${config.api.port}`);
      logger.info('WebSocket server listening on /ws');
    });
  } catch (err: any) {
    logger.error('Failed to start API server', { error: err.message });
    process.exit(1);
  }
}

start();

export { server };
export default app;
