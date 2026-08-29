/**
 * Terminal Service
 *
 * Opens a live SSH connection to a server's host and attaches to the tmux
 * console session that cs2-server-manager (csm) creates for it, so admins
 * can watch the real SRCDS console (including chat) and type commands
 * directly into it from the browser.
 *
 * csm names each server's tmux session `cs2-<N>` where N is the server's
 * numeric index within csm (see sivert-io/cs2-server-manager,
 * src/internal/csm/tmux.go, sessionName()). We only ever build that command
 * from a server-side integer (`server.csmIndex`), never from client input.
 */

import { Client, type ClientChannel } from 'ssh2';
import { serverService } from './serverService';
import { log } from '../utils/logger';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalSession {
  stream: ClientChannel;
  close: () => void;
}

function tmuxSessionName(csmIndex: number): string {
  return `cs2-${csmIndex}`;
}

export class TerminalService {
  /**
   * Open an SSH connection to the given server and attach to its csm tmux
   * console session. Throws with a user-facing message on any failure
   * (missing config, SSH auth/connect failure, or no such tmux session).
   */
  async openSession(serverId: string, size: TerminalSize): Promise<TerminalSession> {
    const server = await serverService.getServerById(serverId);
    if (!server) {
      throw new Error(`Server '${serverId}' not found`);
    }

    if (!server.sshConsoleEnabled) {
      throw new Error(
        'SSH console is not configured for this server. Set csm index, SSH host/username, and credentials in the server settings.'
      );
    }

    const csmIndex = server.csmIndex as number;
    if (!Number.isInteger(csmIndex) || csmIndex < 0) {
      throw new Error('Invalid csm server index configured for this server.');
    }

    const host = server.sshHost || server.host;
    const port = server.sshPort || 22;
    const username = server.sshUsername as string;

    const conn = new Client();

    const connectPromise = new Promise<void>((resolve, reject) => {
      conn.on('ready', () => resolve());
      conn.on('error', (err) => reject(err));
      const connectConfig: Record<string, unknown> = {
        host,
        port,
        username,
        readyTimeout: 15000,
      };
      if (server.sshAuthMethod === 'private_key') {
        connectConfig.privateKey = server.sshPrivateKey || undefined;
        if (server.sshPassphrase) connectConfig.passphrase = server.sshPassphrase;
      } else {
        connectConfig.password = server.sshPassword || undefined;
      }
      conn.connect(connectConfig);
    });

    try {
      await connectPromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SSH connection failed: ${message}`);
    }

    const sessionName = tmuxSessionName(csmIndex);
    const command = `tmux attach -t ${sessionName} || echo "[terminal] no tmux session '${sessionName}' found - is the server started via csm?"`;

    const stream = await new Promise<ClientChannel>((resolve, reject) => {
      conn.exec(
        command,
        { pty: { term: 'xterm-256color', cols: size.cols, rows: size.rows } },
        (err, ch) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(ch);
        }
      );
    }).catch((error: Error) => {
      conn.end();
      throw new Error(`Failed to attach to tmux session '${sessionName}': ${error.message}`);
    });

    stream.on('close', () => {
      conn.end();
    });

    log.info(`[TERMINAL] Attached SSH terminal to ${serverId} (${sessionName})`);

    return {
      stream,
      close: () => {
        try {
          stream.end();
        } catch {
          // Ignore
        }
        try {
          conn.end();
        } catch {
          // Ignore
        }
      },
    };
  }

  resize(stream: ClientChannel, size: TerminalSize): void {
    try {
      stream.setWindow(size.rows, size.cols, 0, 0);
    } catch (error) {
      log.warn('[TERMINAL] Failed to resize terminal window', { error });
    }
  }
}

export const terminalService = new TerminalService();
