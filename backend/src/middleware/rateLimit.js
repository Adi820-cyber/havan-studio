/**
 * Rate limiting middleware.
 *
 * Applies a sliding window per IP. Defaults to 100 requests per 15 minutes.
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX env variables.
 *
 * Auth and upload endpoints get tighter limits applied at the route level.
 */
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/** Global rate limiter — generous default for general API use. */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => {
    // Use X-Forwarded-For behind ALB/CloudFront
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
});

/** Strict limiter for auth endpoints — 20 attempts per 15 minutes. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait and try again.' },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
});

/** Upload limiter — 30 uploads per 15 minutes. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please try again later.' },
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
});
