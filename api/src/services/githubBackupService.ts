/**
 * GitHub Backup Service
 *
 * Pushes JSON snapshots of teams, players, tournament info, and match
 * results to a separate GitHub repo (GITHUB_BACKUP_REPO), authenticated with
 * a token (GITHUB_BACKUP_TOKEN) that is never returned to clients. Each
 * category is written to its own file so history/diffs stay readable, and
 * updates use GitHub's normal "get sha, then PUT" content API flow so this
 * works whether the file already exists or not.
 */

import { db } from '../config/database';
import { teamService } from './teamService';
import { playerService } from './playerService';
import { tournamentService } from './tournamentService';
import { buildMatchReport } from './matchReportService';
import { log } from '../utils/logger';

const GITHUB_API = 'https://api.github.com';

export interface BackupCategoryResult {
  category: string;
  success: boolean;
  path: string;
  error?: string;
}

function getConfig(): { token: string; owner: string; repo: string } | null {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repoFull = process.env.GITHUB_BACKUP_REPO; // "owner/repo"
  if (!token || !repoFull || !repoFull.includes('/')) {
    return null;
  }
  const [owner, repo] = repoFull.split('/');
  return { token, owner, repo };
}

export function isBackupConfigured(): boolean {
  return getConfig() !== null;
}

async function putFile(
  owner: string,
  repo: string,
  token: string,
  path: string,
  content: unknown
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // Look up the current file's sha (required by GitHub's API to update an
  // existing file; omitted entirely when creating a new one).
  let sha: string | undefined;
  const existing = await fetch(url, { headers });
  if (existing.ok) {
    const data = (await existing.json()) as { sha?: string };
    sha = data.sha;
  } else if (existing.status !== 404) {
    const body = await existing.text();
    throw new Error(`Failed to check existing file ${path}: ${existing.status} ${body}`);
  }

  const jsonString = JSON.stringify(content, null, 2);
  const base64Content = Buffer.from(jsonString, 'utf8').toString('base64');

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Backup: update ${path} (${new Date().toISOString()})`,
      content: base64Content,
      sha,
    }),
  });

  if (!putResponse.ok) {
    const body = await putResponse.text();
    throw new Error(`Failed to write ${path}: ${putResponse.status} ${body}`);
  }
}

async function backupCategory(
  category: string,
  path: string,
  buildContent: () => Promise<unknown>,
  config: { token: string; owner: string; repo: string }
): Promise<BackupCategoryResult> {
  try {
    const content = await buildContent();
    await putFile(config.owner, config.repo, config.token, path, content);
    return { category, success: true, path };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`[BACKUP] Failed to sync ${category}`, error as Error);
    return { category, success: false, path, error: message };
  }
}

/**
 * Syncs teams, players, tournament info, and match results to the backup
 * repo as four separate JSON files. Each category is independent - one
 * failing does not stop the others.
 */
export async function syncAllBackups(): Promise<BackupCategoryResult[]> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      'GitHub backup is not configured. Set GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO in .env.'
    );
  }

  const results = await Promise.all([
    backupCategory('teams', 'teams.json', () => teamService.getAllTeams(), config),
    backupCategory('players', 'players.json', () => playerService.getAllPlayers(), config),
    backupCategory('tournament', 'tournament.json', () => tournamentService.getTournament(), config),
    backupCategory(
      'results',
      'results.json',
      async () => {
        const completedSlugs = await db.queryAsync<{ slug: string }>(
          `SELECT slug FROM matches WHERE status = 'completed' ORDER BY completed_at DESC`,
          []
        );
        const reports = await Promise.all(
          completedSlugs.map((row) => buildMatchReport(row.slug))
        );
        return reports.filter(Boolean);
      },
      config
    ),
  ]);

  return results;
}
