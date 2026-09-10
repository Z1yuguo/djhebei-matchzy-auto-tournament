/**
 * Shared SSH connection helper.
 *
 * Both the live console (terminalService, pty-attached to a tmux session)
 * and the CSM plugin-backup actions (csmPluginBackupService, one-off command
 * exec) connect to the same per-server SSH credentials configured in the
 * server settings. This factors out just the "open a connected ssh2.Client"
 * step so the auth-method branching isn't duplicated between them.
 */

import { Client } from 'ssh2';
import type { ServerResponse } from '../types/server.types';

/**
 * Opens an SSH connection using a server's configured SSH console settings.
 * Rejects if `server.sshConsoleEnabled` is false, on auth failure, or on
 * connect timeout. Caller is responsible for calling `conn.end()`.
 */
export function connectSSH(server: ServerResponse, readyTimeoutMs = 15000): Promise<Client> {
  if (!server.sshConsoleEnabled) {
    return Promise.reject(
      new Error(
        'SSH is not configured for this server. Set SSH host/username and credentials in the server settings.'
      )
    );
  }

  const conn = new Client();
  const host = server.sshHost || server.host;
  const port = server.sshPort || 22;
  const username = server.sshUsername as string;

  return new Promise<Client>((resolve, reject) => {
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(err));
    const connectConfig: Record<string, unknown> = {
      host,
      port,
      username,
      readyTimeout: readyTimeoutMs,
    };
    if (server.sshAuthMethod === 'private_key') {
      connectConfig.privateKey = server.sshPrivateKey || undefined;
      if (server.sshPassphrase) connectConfig.passphrase = server.sshPassphrase;
    } else {
      connectConfig.password = server.sshPassword || undefined;
    }
    conn.connect(connectConfig);
  });
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Runs a single non-interactive command over an already-connected SSH
 * client and collects its stdout/stderr/exit code. Use for one-off remote
 * commands (not interactive sessions - see terminalService for those).
 */
export function execCommand(conn: Client, command: string, timeoutMs = 20000): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    conn.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
        return;
      }

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf8');
      });
      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf8');
      });
      stream.on('close', (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? -1 });
      });
    });
  });
}
