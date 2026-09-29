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
import { USE_LOCAL_FALLBACK } from '../config/env.js';

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
      // The real cause — wrong Supabase credentials, RLS, a genuinely down
      // project, a duplicate email — always reaches the log, whether or not
      // the fallback below ends up running.
      console.error(`[auth/signup] Supabase call failed: ${err.message || err}`);

      // Only ever a local-dev convenience, and only when explicitly turned on
      // (see USE_LOCAL_FALLBACK in config/env.js). Never in production: a
      // "successful" signup served from this store is a fake session that
      // vanishes on the next serverless invocation, and the previous
      // unconditional version of this fallback is what made that failure
      // silent instead of visible.
      if (USE_LOCAL_FALLBACK) {
        const { user, session } = localStore.createUser({ email, name, avatar, isAnonymous: false });
        return res.status(201).json({ user, session });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not create your account. Please try again.') });
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
      console.error(`[auth/login] Supabase call failed: ${err.message || err}`);

      // See the note in /signup above. A wrong password used to silently
      // "succeed" here by handing back a brand-new fake account with a
      // different name than the one that owns that email — which is a worse
      // outcome than telling the person their password is wrong.
      if (USE_LOCAL_FALLBACK) {
        const { user, session } = localStore.createUser({ email, name: email.split('@')[0], isAnonymous: false });
        return res.json({ user, session });
      }

      return res.status(401).json({ error: friendlyError(err, 'That email and password combination did not match.') });
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
      console.error(`[auth/anonymous] Supabase call failed: ${err.message || err}`);

      // This is the guest RSVP path — a fake anonymous session here means a
      // guest's RSVP looks like it saved and then is gone the moment a
      // different serverless instance handles their next request.
      if (USE_LOCAL_FALLBACK) {
        const { user, session } = localStore.createUser({ isAnonymous: true });
        return res.json({ user, session });
      }

      return res.status(502).json({ error: friendlyError(err, 'Could not start your session. Please try again.') });
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
