/**
 * CSM Plugin Backup Service
 *
 * Talks to `csm` (cs2-server-manager) over the same per-server SSH
 * connection used by the live console, to list and restore the plugin
 * backups csm takes automatically before every `update-plugins` run (see
 * djhebei/cs2-server-manager: plugin_backups/, `csm list-plugin-backups
 * --json`, `csm rollback-plugins`). This is what lets an admin "roll back to
 * the last plugin versions that worked" from the panel instead of SSHing in.
 *
 * `list-plugin-backups` only reads files under csm's root (world-readable)
 * so it runs without sudo. `rollback-plugins` writes into csm's root and
 * restarts every server, so it needs root - the configured SSH user must
 * have passwordless sudo for it. Add, on the CS2 host:
 *
 *   cs2servermanager ALL=(root) NOPASSWD: /usr/local/bin/csm rollback-plugins *, \
 *                                          /usr/local/bin/csm rollback-plugins
 *
 * (replace `cs2servermanager` with whatever SSH username is configured for
 * the server). Without this, rollback attempts fail fast with a clear error
 * instead of hanging on a password prompt (`sudo -n` never blocks).
 */

import { serverService } from './serverService';
import { connectSSH, execCommand } from './sshClient';
import type { ServerResponse } from '../types/server.types';
import { log } from '../utils/logger';

const CSM_BIN = '/usr/local/bin/csm';

/** Backup ids are csm's own timestamp directory names (20060102-150405). */
const BACKUP_ID_PATTERN = /^\d{8}-\d{6}$/;

export interface CsmPluginBackup {
  id: string;
  hasManifest: boolean;
  metamod?: string;
  counterstrikesharp?: string;
  matchzy?: string;
  capturedAt?: string;
}

export interface CsmRollbackResult {
  success: true;
  backupId?: string;
  output: string;
}

async function getServerForSSH(serverId: string): Promise<ServerResponse> {
  const server = await serverService.getServerById(serverId);
  if (!server) {
    throw new Error(`Server '${serverId}' not found`);
  }
  if (!server.sshConsoleEnabled) {
    throw new Error(
      'SSH is not configured for this server. Set SSH host/username and credentials in the server settings.'
    );
  }
  return server;
}

/**
 * Lists the plugin backups available on the CS2 host behind this server's
 * SSH connection, most recent first. Since one csm install manages every
 * server on a host, this list is the same regardless of which server on
 * that host you ask through.
 */
export async function listPluginBackups(serverId: string): Promise<CsmPluginBackup[]> {
  const server = await getServerForSSH(serverId);
  const conn = await connectSSH(server);
  try {
    const { stdout, stderr, code } = await execCommand(conn, `${CSM_BIN} list-plugin-backups --json`, 20000);
    if (code !== 0) {
      throw new Error(stderr.trim() || `csm list-plugin-backups exited with code ${code}`);
    }
    try {
      return JSON.parse(stdout) as CsmPluginBackup[];
    } catch {
      throw new Error(`Could not parse csm output as JSON: ${stdout.slice(0, 500)}`);
    }
  } finally {
    conn.end();
  }
}

/**
 * Restores a plugin backup on the CS2 host and redeploys it to every server
 * csm manages there (stopping and restarting them). Pass no backupId to
 * restore the most recent snapshot - the versions running immediately
 * before the last plugin update.
 */
export async function rollbackPlugins(serverId: string, backupId?: string): Promise<CsmRollbackResult> {
  if (backupId !== undefined && !BACKUP_ID_PATTERN.test(backupId)) {
    throw new Error(`Invalid backup id '${backupId}'`);
  }

  const server = await getServerForSSH(serverId);
  const conn = await connectSSH(server);
  try {
    const command = `sudo -n ${CSM_BIN} rollback-plugins${backupId ? ` ${backupId}` : ''}`;
    log.info(`[CSM] Rolling back plugins via ${server.name} (${server.sshHost})`, { backupId: backupId ?? 'latest' });

    // Restoring + restarting every server on the host can take a little
    // while (stop, rsync, start) - give it more room than a quick read.
    const { stdout, stderr, code } = await execCommand(conn, command, 5 * 60 * 1000);
    const output = [stdout, stderr].filter((s) => s.trim().length > 0).join('\n');

    if (code !== 0) {
      if (/password is required/i.test(output)) {
        throw new Error(
          `The SSH user '${server.sshUsername}' does not have passwordless sudo for csm rollback-plugins. ` +
            'Add a NOPASSWD sudoers rule for it on the CS2 host, then try again.'
        );
      }
      throw new Error(output.trim() || `csm rollback-plugins exited with code ${code}`);
    }

    return { success: true, backupId, output };
  } finally {
    conn.end();
  }
}
