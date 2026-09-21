/**
 * Comments (Hype Wall) routes.
 *
 * GET  /api/comments/:slug — list threaded comments for an event
 * POST /api/comments/:slug — post a new comment or reply
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';

const router = Router();

/**
 * GET /api/comments/:slug
 * Returns threaded comments for an invitation.
 */
router.get(
  '/:slug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const limit = parseInt(req.query.limit, 10) || 200;

    try {
      const client = createUserClient(req.accessToken);
      const { data, error } = await client.rpc('get_event_comments', {
        p_slug: slug,
        p_limit: Math.min(limit, 500),
      });

      if (error || !data) throw error || new Error('RPC error');

      return res.json({ data });
    } catch (err) {
      const data = localStore.getComments(slug, req.user);
      return res.json({ data });
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
      const data = localStore.postComment(slug, req.user, req.body);
      return res.status(201).json({ data });
    }
  })
);

export default router;
