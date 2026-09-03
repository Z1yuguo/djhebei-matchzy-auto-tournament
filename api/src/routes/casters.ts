import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { casterService } from '../services/casterService';
import { log } from '../utils/logger';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/casters
 * List all registered cast/broadcaster SteamIDs.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const casters = await casterService.getAllCasters();
    return res.json({ success: true, casters });
  } catch (error) {
    log.error('Error fetching casters', error as Error);
    return res.status(500).json({ success: false, error: 'Failed to fetch casters' });
  }
});

/**
 * POST /api/casters
 * Add or update a cast member.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, avatar } = req.body as { id?: string; name?: string; avatar?: string };
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'id and name are required' });
    }
    const caster = await casterService.upsertCaster(id, name, avatar);
    return res.json({ success: true, caster });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save caster';
    return res.status(400).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/casters/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await casterService.deleteCaster(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Caster not found' });
    }
    return res.json({ success: true });
  } catch (error) {
    log.error('Error deleting caster', error as Error);
    return res.status(500).json({ success: false, error: 'Failed to delete caster' });
  }
});

export default router;
