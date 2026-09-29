/**
 * Comments (Hype Wall) routes.
 *
 * GET  /api/comments/:slug — list threaded comments for an event
 * POST /api/comments/:slug — post a new comment or reply
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';
import { USE_LOCAL_FALLBACK } from '../config/env.js';

const router = Router();

/**
 * GET /api/comments/:slug
 * Returns threaded comments for an invitation.
 */
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const limit = parseInt(req.query.limit, 10) || 200;

    // Anonymous invite readers cannot be hosts or RSVP guests, so their wall
    // is empty by design. Avoid sending a role with no identity to the RPC.
    if (!req.user) return res.json({ data: [] });

    try {
      const client = createUserClient(req.accessToken || '');
      const { data, error } = await client.rpc('get_event_comments', {
        p_slug: slug,
        p_limit: Math.min(limit, 500),
      });

      if (error || !data) throw error || new Error('RPC error');

      return res.json({ data });
    } catch (err) {
      console.error(`[comments/get] Supabase call failed for slug "${slug}": ${err.message || err}`);

      if (USE_LOCAL_FALLBACK) {
        const data = localStore.getComments(slug, req.user);
        return res.json({ data });
      }

      // An empty wall used to be indistinguishable from a database error — a
      // guest scrolling to "nobody has said anything yet" when the real story
      // is the request failed had no way to know to reload.
      return res.status(502).json({ error: friendlyError(err, 'Could not load the wall right now. Please try again.') });
    }
  })
);

/**
 * POST /api/comments/:slug
 * Body: { message, authorName?, parentId?, avatar? }
 */
router.post(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { message, authorName, parentId, avatar } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    try {
      const client = createUserClient(req.accessToken);
      const { data, error } = await client.rpc('post_comment', {
        p_slug: slug,
        p_message: message.trim(),
        p_author_name: authorName || null,
        p_avatar: avatar || '✨',
        p_parent_id: parentId || null,
      });

      if (error || !data) throw error || new Error('RPC error');

      return res.status(201).json({ data });
    } catch (err) {
      console.error(`[comments/post] Supabase call failed for slug "${slug}": ${err.message || err}`);

      // A note that "posted" successfully here and then never appeared to
      // anyone else reading the same wall is worse than a visible failure —
      // the guest has no reason to try again, since as far as they know it
      // already worked.
      if (USE_LOCAL_FALLBACK) {
        const data = localStore.postComment(slug, req.user, req.body);
        return res.status(201).json({ data });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not post your message. Please try again.') });
    }
  })
);

export default router;
