/**
 * RSVP routes.
 *
 * POST /api/rsvp/:slug — submit or update the caller's RSVP
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';
import { USE_LOCAL_FALLBACK } from '../config/env.js';

const router = Router();

/**
 * POST /api/rsvp/:slug
 * Body: { guestName, contact?, status?, dietaryNotes?, plusOnes?, note?, token? }
 */
router.post(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { guestName, contact, status, dietaryNotes, plusOnes, note, token } = req.body;

    if (!guestName) {
      return res.status(400).json({ error: 'Guest name is required.' });
    }

    try {
      const client = createUserClient(req.accessToken);

      const { data, error } = await client.rpc('submit_rsvp', {
        p_slug: slug,
        p_guest_name: guestName,
        p_contact: contact || null,
        p_status: status || 'going',
        p_dietary_notes: dietaryNotes || null,
        p_plus_ones: plusOnes || 0,
        p_note: note || null,
        p_token: token || null,
      });

      if (error || !data) throw error || new Error('RPC error');

      return res.json({ data });
    } catch (err) {
      console.error(`[rsvp/submit] Supabase call failed for slug "${slug}": ${err.message || err}`);

      // A guest who tapped "going" and saw the reveal animation fire, believing
      // they were on the list, only to have that RSVP exist nowhere the host
      // could ever see it — that is the exact failure this silent fallback
      // produced, and it is worse than telling the guest to try again.
      if (USE_LOCAL_FALLBACK) {
        const data = localStore.submitRsvp(slug, req.user, req.body);
        return res.json({ data });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not save your reply. Please try again.') });
    }
  })
);

export default router;
