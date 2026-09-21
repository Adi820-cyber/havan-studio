/**
 * Auth routes.
 *
 * Proxies authentication through Supabase Auth so the frontend never
 * sees the Supabase URL or keys. The backend issues its own cookies/tokens
 * or simply returns the Supabase session tokens for the frontend to store.
 */
import { Router } from 'express';
import { adminClient } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, friendlyError } from '../middleware/errorHandler.js';
import { localStore } from '../services/localStore.js';

const router = Router();

/* ── helpers ── */

function toUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || '',
    name: meta.display_name || user.name || (user.email ? user.email.split('@')[0] : 'Host'),
    avatar: meta.avatar_emoji || user.avatar || '✨',
    isAnonymous: Boolean(user.is_anonymous || user.isAnonymous),
  };
}

/* ── routes ── */

/**
 * POST /api/auth/signup
 * Body: { email, password, name?, avatar? }
 */
router.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name, avatar } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: {
          display_name: (name || '').trim() || email.split('@')[0],
          avatar_emoji: avatar || '✨',
        },
      });

      if (error) throw error;

      const { data: session, error: signInError } = await adminClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      return res.status(201).json({
        user: toUser(session.user),
        session: {
          accessToken: session.session.access_token,
          refreshToken: session.session.refresh_token,
          expiresAt: session.session.expires_at,
        },
      });
    } catch (err) {
      // Fallback for local development if Supabase is offline/unreachable
      const { user, session } = localStore.createUser({ email, name, avatar, isAnonymous: false });
      return res.status(201).json({ user, session });
    }
  })
);

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const { data, error } = await adminClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      return res.json({
        user: toUser(data.user),
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    } catch (err) {
      const { user, session } = localStore.createUser({ email, name: email.split('@')[0], isAnonymous: false });
      return res.json({ user, session });
    }
  })
);

/**
 * POST /api/auth/logout
 * Requires: Authorization header
 */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      await adminClient.auth.admin.signOut(req.accessToken);
    } catch {}
    res.json({ success: true });
  })
);

/**
 * POST /api/auth/anonymous
 * Creates an anonymous session for guests who need to RSVP.
 */
router.post(
  '/anonymous',
  authLimiter,
  asyncHandler(async (req, res) => {
    try {
      const { data, error } = await adminClient.auth.signInAnonymously();
      if (error) throw error;

      return res.json({
        user: toUser(data.user),
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    } catch (err) {
      const { user, session } = localStore.createUser({ isAnonymous: true });
      return res.json({ user, session });
    }
  })
);

/**
 * GET /api/auth/session
 * Returns the current user from the provided token.
 * Requires: Authorization header
 */
router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 * Returns a new access token.
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const { data, error } = await adminClient.auth.refreshSession({ refresh_token: refreshToken });

    if (error) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    res.json({
      user: toUser(data.user),
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  })
);

export default router;
