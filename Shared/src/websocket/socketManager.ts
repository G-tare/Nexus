import { Server as HttpServer, IncomingMessage } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';
import type { AuthUser } from '../api/middleware/auth';

const logger = createModuleLogger('WebSocket');

/**
 * Events that can be emitted through WebSocket.
 */
export type WSEventType =
  | 'ticket:created'
  | 'ticket:updated'
  | 'ticket:message'
  | 'ticket:closed'
  | 'ticket:claimed'
  | 'ticket:reopened'
  | 'module:toggled'
  | 'alert:triggered'
  | 'stats:update';

interface WSMessage {
  event: WSEventType;
  data: unknown;
  timestamp: string;
}

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAlive?: boolean;
}

/**
 * Singleton WebSocket manager.
 * Provides real-time event delivery to authenticated dashboard clients.
 * Uses raw `ws` package (no socket.io) per project constraints.
 */
class SocketManager {
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Attach WebSocket upgrade handler to an existing HTTP server.
   */
  attach(server: HttpServer): void {
    if (this.wss) {
      logger.warn('WebSocket server already attached');
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade — authenticate before upgrading
    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      // Only handle /ws path
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }

      // Extract JWT from query string (?token=xxx) or Authorization header
      const token = url.searchParams.get('token')
        || request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify JWT
      let user: AuthUser;
      try {
        user = jwt.verify(token, config.api.jwtSecret) as AuthUser;
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify owner status (only owners can connect to WebSocket)
      if (!config.discord.ownerIds.includes(user.id)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        const authWs = ws as AuthenticatedSocket;
        authWs.userId = user.id;
        authWs.username = user.username;
        authWs.isAlive = true;
        this.wss!.emit('connection', authWs, request);
      });
    });

    this.wss.on('connection', (ws: AuthenticatedSocket) => {
      logger.info('WebSocket client connected', { userId: ws.userId });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        // Handle client messages (e.g., ping/pong, subscription filters)
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected', { userId: ws.userId });
      });

      ws.on('error', (err) => {
        logger.error('WebSocket client error', { userId: ws.userId, error: err.message });
      });

      // Send welcome message
      ws.send(JSON.stringify({
        event: 'connected',
        data: { message: 'Connected to Nexus Bot WebSocket' },
        timestamp: new Date().toISOString(),
      }));
    });

    // Heartbeat: ping every 30 seconds, terminate unresponsive clients
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedSocket;
        if (authWs.isAlive === false) {
          logger.info('Terminating unresponsive WebSocket client', { userId: authWs.userId });
          authWs.terminate();
          return;
        }
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000);

    logger.info('WebSocket server attached');
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcast(event: WSEventType, data: unknown): void {
    if (!this.wss) return;

    const message: WSMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    const payload = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Send an event to a specific user by Discord ID.
   */
  sendToUser(userId: string, event: WSEventType, data: unknown): void {
    if (!this.wss) return;

    const message: WSMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    const payload = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.userId === userId && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Get the count of connected clients.
   */
  getClientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  /**
   * Clean shutdown of WebSocket server.
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
      logger.info('WebSocket server closed');
    }
  }
}

export const socketManager = new SocketManager();
export default socketManager;
