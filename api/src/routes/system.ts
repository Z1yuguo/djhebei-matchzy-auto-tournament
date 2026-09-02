/**
 * System info routes
 *
 * Small helpers for admin UI convenience that don't fit any existing
 * resource route.
 */

import { Router, Request, Response } from 'express';
import os from 'os';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

function stripPort(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  // IPv6 literal host header looks like "[::1]:3070" - keep the brackets off.
  if (hostHeader.startsWith('[')) {
    const end = hostHeader.indexOf(']');
    return end === -1 ? null : hostHeader.slice(1, end);
  }
  return hostHeader.split(':')[0] || null;
}

/**
 * GET /api/system/network-info
 *
 * Returns the address the caller's browser is currently using to reach this
 * server (from the HTTP Host header) alongside any non-internal IPv4
 * addresses this process's own network interfaces report. The API runs
 * inside a Docker container on a bridge network, so it generally can't see
 * the host machine's real LAN interfaces directly - but whatever address the
 * browser used to successfully load the page IS, by definition, a currently
 * working address for this machine, which is what admins actually need when
 * a DHCP lease changes (e.g. servers on unstable networks like a net cafe).
 */
router.get('/network-info', (req: Request, res: Response) => {
  const requestHost = stripPort(req.headers.host);

  const interfaceIps: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        interfaceIps.push(addr.address);
      }
    }
  }

  res.json({
    success: true,
    requestHost,
    interfaceIps,
  });
});

export default router;
