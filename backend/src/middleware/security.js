/**
 * Comprehensive security headers middleware.
 *
 * This middleware runs BEFORE helmet and all other middleware. It:
 *   1. Strips headers that reveal the tech stack (Server, X-Powered-By, etc.)
 *   2. Sets a branded Server header to mask the real stack
 *   3. Adds Cross-Origin isolation policies
 *   4. Adds request-ID tracking for debugging
 *   5. Sets API-specific cache-busting headers
 *
 * helmet still runs after this for its additional protections (HSTS, etc.),
 * but this middleware owns the tech-stack-hiding and fingerprint-masking.
 */
import crypto from 'crypto';

/* ── Headers to strip (case-insensitive removal) ── */

const STRIP_HEADERS = [
  'Server',
  'X-Powered-By',
  'X-AspNet-Version',
  'X-AspNetMvc-Version',
  'X-Runtime',
  'X-Version',
];

/**
 * Global security proxy — runs on EVERY request (before routes).
 * Hides tech stack and adds cross-origin isolation headers.
 */
export function securityProxy(req, res, next) {
  /* ── Request ID for tracing ── */
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  /* ── Strip tech-stack fingerprinting headers ── */
  for (const header of STRIP_HEADERS) {
    res.removeHeader(header);
  }

  /* ── Branded Server header — hides Express/Node ── */
  res.setHeader('Server', 'HAVAN');

  /* ── Cross-Origin isolation ── */
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  /* ── Prevent DNS prefetching leaks ── */
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  /* ── Disable legacy XSS filter (CSP replaces it; the filter can cause issues) ── */
  res.setHeader('X-XSS-Protection', '0');

  /* ── Prevent rendering in iframes ── */
  res.setHeader('X-Frame-Options', 'DENY');

  /* ── Prevent MIME sniffing ── */
  res.setHeader('X-Content-Type-Options', 'nosniff');

  /* ── Referrer policy ── */
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  /* ── Permissions policy — disable unused browser APIs ── */
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  next();
}

/**
 * API-specific security and cache-control headers.
 * Applied only to /api/* routes.
 */
export function apiSecurityHeaders(req, res, next) {
  // Prevent sensitive API response caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  next();
}

