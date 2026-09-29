/**
 * Rate limiting middleware.
 *
 * Applies a sliding window per IP. Defaults to 100 requests per 15 minutes.
 * Configurable via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX env variables.
 *
 * Auth and upload endpoints get tighter limits applied at the route level.
 *
 * IP resolution — do not read x-forwarded-for by hand. Every limiter here
 * used to do `req.headers['x-forwarded-for']?.split(',')[0] || req.ip`, which
 * trusts whatever the client claims as its own IP. That happens to be safe on
 * Vercel today, because Vercel's edge overwrites x-forwarded-for before it
 * reaches this function and does not forward client-supplied values — but
 * this app is meant to be portable to a plain AWS deployment (ALB/CloudFront/
 * ECS), where nothing strips that header by default. There, the old code let
 * anyone reset their own rate limit on every request by sending a different
 * X-Forwarded-For value — a complete bypass of authLimiter's brute-force
 * protection. `req.ip` is used instead everywhere below: Express computes it
 * from the `trust proxy` setting in app.js, which now trusts exactly one hop
 * (the platform's own edge/load balancer) instead of the entire header chain,
 * so it reflects the real client IP on both Vercel and a correctly-configured
 * AWS ALB/CloudFront setup without re-implementing proxy trust here too.
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
});

/** Strict limiter for auth endpoints — 20 attempts per 15 minutes. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait and try again.' },
});

/** Upload limiter — 30 uploads per 15 minutes. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please try again later.' },
});

/** Feedback is easy to send while limiting automated form spam. */
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have sent a few notes already. Please try again later.' },
});

/** Realtime streams are longer-lived than normal requests, so throttle opens. */
export const sseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many live connections. Please try again shortly.' },
});
