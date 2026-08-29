/**
 * Terminal Socket Service
 *
 * Exposes the SSH web terminal (terminalService) over a dedicated,
 * authenticated Socket.io namespace ("/admin-terminal"), separate from the
 * main `io` instance in socketService.ts. The main instance is intentionally
 * public/unauthenticated (tournament & bracket updates are public data) —
 * a raw shell must never share that channel, so it gets its own namespace
 * with a handshake auth check that mirrors requireAuth's cookie fallback.
 */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { ClientChannel } from 'ssh2';
import { getVerifiedPlayerSteamId } from '../utils/signedPlayerCookie';
import { checkAdminBySteamId } from '../middleware/auth';
import { terminalService } from './terminalService';
import { log } from '../utils/logger';

const MAX_COLS = 500;
const MAX_ROWS = 200;

function clampSize(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export function initializeTerminalNamespace(io: SocketIOServer): void {
  const nsp = io.of('/admin-terminal');

  nsp.use((socket, next) => {
    void (async () => {
      try {
        const cookieHeader = socket.handshake.headers.cookie;
        const steamId = getVerifiedPlayerSteamId(cookieHeader);
        if (!steamId) {
          next(new Error('Unauthorized'));
          return;
        }
        const isAdmin = await checkAdminBySteamId(steamId);
        if (!isAdmin) {
          next(new Error('Forbidden'));
          return;
        }
        next();
      } catch (error) {
        log.error('[TERMINAL] Socket auth check failed', error);
        next(new Error('Unauthorized'));
      }
    })();
  });

  nsp.on('connection', (socket: Socket) => {
    let activeStream: ClientChannel | null = null;
    let closeSession: (() => void) | null = null;

    const stopSession = () => {
      if (closeSession) {
        closeSession();
        closeSession = null;
      }
      activeStream = null;
    };

    socket.on(
      'terminal:start',
      (payload: { serverId?: string; cols?: number; rows?: number }) => {
        void (async () => {
          stopSession();

          const serverId = payload?.serverId;
          if (!serverId || typeof serverId !== 'string') {
            socket.emit('terminal:error', 'Missing serverId');
            return;
          }

          const size = {
            cols: clampSize(payload?.cols, 80, MAX_COLS),
            rows: clampSize(payload?.rows, 24, MAX_ROWS),
          };

          try {
            const session = await terminalService.openSession(serverId, size);
            activeStream = session.stream;
            closeSession = session.close;

            session.stream.on('data', (data: Buffer) => {
              socket.emit('terminal:output', data.toString('utf8'));
            });
            session.stream.stderr?.on('data', (data: Buffer) => {
              socket.emit('terminal:output', data.toString('utf8'));
            });
            session.stream.on('close', () => {
              socket.emit('terminal:closed');
              activeStream = null;
            });

            socket.emit('terminal:ready');
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            socket.emit('terminal:error', message);
          }
        })();
      }
    );

    socket.on('terminal:input', (data: string) => {
      if (activeStream && typeof data === 'string') {
        activeStream.write(data);
      }
    });

    socket.on('terminal:resize', (payload: { cols?: number; rows?: number }) => {
      if (activeStream) {
        terminalService.resize(activeStream, {
          cols: clampSize(payload?.cols, 80, MAX_COLS),
          rows: clampSize(payload?.rows, 24, MAX_ROWS),
        });
      }
    });

    socket.on('terminal:stop', () => {
      stopSession();
    });

    socket.on('disconnect', () => {
      stopSession();
    });
  });

  log.success('Admin terminal socket namespace initialized (/admin-terminal)');
}
