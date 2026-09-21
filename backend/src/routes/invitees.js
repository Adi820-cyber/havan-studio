/**
 * Private invitee management routes.
 *
 * POST   /api/invitees/:slug       — add an invitee (host-only)
 * GET    /api/invitees/:slug       — list invitees (host-only)
 * DELETE /api/invitees/:inviteeId  — remove an invitee (host-only)
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /api/invitees/:slug
 * Body: { name, contact? }
 */
router.post(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { name, contact } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Guest name is required.' });
    }

    const client = createUserClient(req.accessToken);
    const { data, error } = await client.rpc('add_event_invitee', {
      p_slug: slug,
      p_name: name.trim(),
      p_contact: contact || null,
    });

    if (error) {
      return res.status(403).json({ error: friendlyError(error, 'Could not add that guest.') });
    }

    res.status(201).json({ data });
  })
);

/**
 * GET /api/invitees/:slug
 * Returns all invitees for a private event (host-only).
 */
router.get(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const client = createUserClient(req.accessToken);

    const { data, error } = await client.rpc('list_event_invitees', { p_slug: slug });

    if (error) {
      return res.status(403).json({ error: friendlyError(error, 'Could not load your invite list.') });
    }

    res.json({ data: data || [] });
  })
);

/**
 * DELETE /api/invitees/:inviteeId
 * Revokes an invitee's link.
 */
router.delete(
  '/:inviteeId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { inviteeId } = req.params;
    const client = createUserClient(req.accessToken);

    const { error } = await client.rpc('remove_event_invitee', {
      p_invitee_id: inviteeId,
    });

    if (error) {
      return res.status(403).json({ error: friendlyError(error, 'Could not remove that guest.') });
    }

    res.json({ success: true });
  })
);

export default router;
