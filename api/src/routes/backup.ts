import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { syncAllBackups, isBackupConfigured } from '../services/githubBackupService';
import { log } from '../utils/logger';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/backup/status
 * Whether GitHub backup sync is configured on this deployment.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, configured: isBackupConfigured() });
});

/**
 * POST /api/backup/sync
 * Pushes teams, players, tournament, and results JSON to the configured
 * GitHub backup repo. Each category is reported independently so a partial
 * failure (e.g. one category errors) doesn't hide the others' success.
 */
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const results = await syncAllBackups();
    const allSucceeded = results.every((r) => r.success);
    return res.status(allSucceeded ? 200 : 207).json({ success: allSucceeded, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync backups';
    log.error('[BACKUP] Sync failed', error as Error);
    return res.status(400).json({ success: false, error: message });
  }
});

export default router;
