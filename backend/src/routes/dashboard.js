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
      const data = localStore.getMyInvites(req.user);
      return res.json({ data });
    }
  })
);

export default router;
