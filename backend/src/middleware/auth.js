/**
 * Authentication middleware.
 *
 * Extracts the JWT from the Authorization header and validates it against
 * Supabase Auth. On success `req.user` and `req.accessToken` are set.
 *
 * Two variants:
 *   - `requireAuth`  — 401 if no valid token
 *   - `optionalAuth` — proceeds with req.user = null if no token
 */
import { adminClient } from '../config/supabase.js';
import { localStore } from '../services/localStore.js';

/**
 * Extracts the access token from the Authorization header.
 * @returns {string|null}
 */
function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.split(' ')[1];
}

function sessionMessage(req, invalid = false) {
  const path = (req.originalUrl || req.path || '').split('?')[0];
  if (path.startsWith('/api/rsvp/')) {
    return invalid
      ? 'Your guest session expired. Reload the invitation and try again; no account is needed.'
      : 'A guest session is needed to save your reply. Reload the invitation and try again; no account is needed.';
  }
  if (path.startsWith('/api/dashboard')) {
    return invalid
      ? 'Your session expired. Sign in again to view your dashboard.'
      : 'Sign in to view your private dashboard and invitations.';
  }
  if (path.startsWith('/api/profiles')) {
    return invalid
      ? 'Your session expired. Sign in again to manage your profile.'
      : 'Sign in to view or update your profile.';
  }
  if (path.startsWith('/api/events') || path.startsWith('/api/invitees')) {
    return invalid
      ? 'Your session expired. Sign in again to manage this invitation.'
      : 'Sign in to create or manage invitations. Public invitations remain open to guests.';
  }
  return invalid
    ? 'Your session is invalid or expired. Please sign in again.'
    : 'A valid session is required for this action.';
}

/**
 * Validates a Supabase JWT and returns the user object.
 * @param {string} token
 * @returns {Promise<{user: object}|{error: string}>}
 */
async function validateToken(token) {
  if (token && token.startsWith('token_')) {
    const localUser = localStore.getUserByToken(token);
    if (localUser) return { user: localUser };
    // Local fallback sessions live only in this process. If the server was
    // restarted, reject the stale token here instead of asking Supabase to
    // parse a development-only token as a JWT.
    return { error: 'Local development session expired.' };
  }

  try {
    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data?.user) {
      const localUser = localStore.getUserByToken(token);
      if (localUser) return { user: localUser };
      return { error: error?.message || 'Invalid session token.' };
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.display_name || (data.user.email ? data.user.email.split('@')[0] : 'Guest'),
        avatar: data.user.user_metadata?.avatar_emoji || '✨',
        isAnonymous: Boolean(data.user.is_anonymous),
      },
    };
  } catch (err) {
    const localUser = localStore.getUserByToken(token);
    if (localUser) return { user: localUser };
    return { error: 'Token validation failed.' };
  }
}

/**
 * Middleware: requires a valid auth token. Returns 401 otherwise.
 */
export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: sessionMessage(req) });
  }

  const result = await validateToken(token);
  if (result.error) {
    // Keep provider/JWT diagnostics in server logs. Returning them to the
    // browser can expose implementation details and gives guests no useful
    // next step.
    console.warn(`[auth] rejected session for ${req.method} ${req.path}: ${result.error}`);
    return res.status(401).json({ error: sessionMessage(req, true) });
  }

  req.user = result.user;
  req.accessToken = token;
  next();
}

/**
 * Middleware: attaches user if a valid token is present, proceeds without one.
 */
export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    req.accessToken = null;
    return next();
  }

  const result = await validateToken(token);
  if (result.error) {
    req.user = null;
    req.accessToken = null;
    return next();
  }

  req.user = result.user;
  req.accessToken = token;
  next();
}
