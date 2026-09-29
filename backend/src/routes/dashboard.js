/**
 * Dashboard routes.
 *
 * GET /api/dashboard/invites — caller's hosted + attended invitations
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';
import { USE_LOCAL_FALLBACK } from '../config/env.js';

const router = Router();

/**
 * GET /api/dashboard/invites
 * Returns the caller's hosted and accepted invitations.
 * Takes no arguments — identity comes from the session.
 */
router.get(
  '/invites',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      const client = createUserClient(req.accessToken);
      const { data, error } = await client.rpc('get_my_invites');
      if (error || !data) throw error || new Error('RPC error');

      return res.json({ data });
    } catch (err) {
      console.error(`[dashboard/invites] Supabase call failed for user ${req.user?.id}: ${err.message || err}`);

      // This is where the previous behaviour was most visible to a real host:
      // an event they had genuinely published, sitting in the real database,
      // would silently be replaced on this one screen by whatever
      // localStore happened to have in memory — which reads exactly like "the
      // event you created is gone", even though it never was.
      if (USE_LOCAL_FALLBACK) {
        const data = localStore.getMyInvites(req.user);
        return res.json({ data });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not load your invitations right now. Please try again.') });
    }
  })
);

export default router;
