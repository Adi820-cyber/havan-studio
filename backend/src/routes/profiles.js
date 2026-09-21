/**
 * Profile routes.
 *
 * GET  /api/profiles/me          — caller's own profile
 * PUT  /api/profiles/me          — update own profile
 * GET  /api/profiles/:handle     — public profile by handle
 */
import { Router } from 'express';
import { createUserClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/profiles/me
 * Returns the caller's own profile.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const client = createUserClient(req.accessToken);
    const { data, error } = await client.rpc('get_my_profile');

    if (error) {
      return res.status(500).json({ error: friendlyError(error, 'Could not load your profile.') });
    }

    res.json({ data });
  })
);

/**
 * PUT /api/profiles/me
 * Body: { displayName?, handle?, bio?, city?, avatar?, avatarUrl?, isPublic?,
 *         instagram?, vsco?, spotify?, playlistUrl? }
 */
router.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = req.body;
    const client = createUserClient(req.accessToken);

    const { data, error } = await client.rpc('update_my_profile', {
      p_display_name: input.displayName ?? null,
      p_handle: input.handle ?? null,
      p_bio: input.bio ?? null,
      p_city: input.city ?? null,
      p_avatar_emoji: input.avatar ?? null,
      p_avatar_url: input.avatarUrl ?? null,
      p_is_public: input.isPublic ?? null,
      p_instagram: input.instagram ?? null,
      p_vsco: input.vsco ?? null,
      p_spotify: input.spotify ?? null,
      p_playlist_url: input.playlistUrl ?? null,
    });

    if (error) {
      const msg = error.message || '';
      if (/handle_taken/i.test(msg)) {
        return res.status(409).json({ error: 'That handle is already taken. Try another.' });
      }
      if (/handle_invalid/i.test(msg)) {
        return res.status(400).json({
          error: 'Handles can use letters, numbers, dots and underscores, 2–30 characters.',
        });
      }
      return res.status(500).json({ error: friendlyError(error, 'Could not save your profile.') });
    }

    res.json({ data });
  })
);

/**
 * GET /api/profiles/:handle
 * Returns a public profile by handle.
 */
router.get(
  '/:handle',
  asyncHandler(async (req, res) => {
    const { handle } = req.params;

    // Use admin client for public profile reads (no auth needed)
    const { createUserClient: _ } = await import('../config/supabase.js');
    const { adminClient } = await import('../config/supabase.js');

    const { data, error } = await adminClient.rpc('get_public_profile', {
      p_handle: handle,
    });

    if (error) {
      return res.status(404).json({ error: friendlyError(error, 'Could not load that profile.') });
    }

    if (!data) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    res.json({ data });
  })
);

export default router;
