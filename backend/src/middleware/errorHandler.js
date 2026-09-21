/**
 * Centralised error handling middleware.
 *
 * Catches any error thrown or passed to next(err) and returns a consistent
 * JSON response. Strips internal details in production.
 */
import env from '../config/env.js';

/**
 * Turns a Postgres/PostgREST/Supabase error into something worth showing.
 * Same logic as the old frontend friendlyError, now lives server-side.
 */
export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const msg = String(error.message || '');

  if (/duplicate key|already registered|already been registered/i.test(msg)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/Invalid login credentials/i.test(msg)) {
    return 'That email and password combination did not match.';
  }
  if (/Password should be at least/i.test(msg)) {
    return 'Password must be at least 8 characters and mix upper case, lower case and a digit.';
  }
  if (/password.*(weak|requirement)/i.test(msg)) {
    return 'Please choose a stronger password: at least 8 characters with upper case, lower case and a digit.';
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return 'You do not have access to do that.';
  }
  if (/RSVP first to post/i.test(msg)) {
    return 'RSVP first, then you can post on the wall.';
  }
  if (/Invitation not found/i.test(msg)) {
    return 'That invitation code does not match any gathering.';
  }
  if (/Authentication required|must have a session/i.test(msg)) {
    return 'Please sign in and try again.';
  }
  if (/replies.*closed|deadline.*passed/i.test(msg)) {
    return 'Replies are closed for this event.';
  }
  if (/host cannot rsvp|cannot rsvp.*own/i.test(msg)) {
    return 'You cannot RSVP to your own event.';
  }
  return msg || fallback;
}

/**
 * Express error handler — must be registered last.
 */
export function errorHandler(err, req, res, _next) {
  // CORS error from our middleware
  if (err.message && err.message.includes('not allowed by CORS')) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = friendlyError(err);

  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err);
  }

  res.status(statusCode).json({
    error: message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Wraps an async route handler so thrown errors are caught by Express.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
