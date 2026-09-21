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

/**
 * Validates a Supabase JWT and returns the user object.
 * @param {string} token
 * @returns {Promise<{user: object}|{error: string}>}
 */
async function validateToken(token) {
  if (token && token.startsWith('token_')) {
    const localUser = localStore.getUserByToken(token);
    if (localUser) return { user: localUser };
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
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const result = await validateToken(token);
  if (result.error) {
    return res.status(401).json({ error: result.error });
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
