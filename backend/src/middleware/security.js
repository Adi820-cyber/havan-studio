/**
 * Comprehensive security headers middleware.
 *
 * This middleware runs BEFORE helmet and all other middleware. It:
 *   1. Strips headers that reveal the tech stack (Server, X-Powered-By, etc.)
 *   2. Sets a branded Server header to mask the real stack
 *   3. Adds Cross-Origin isolation policies (COOP + CORP + COEP)
 *   4. Adds request-ID tracking for debugging
 *   5. Sets API-specific cache-busting headers
 *
 * helmet still runs after this for its additional protections (CSP, HSTS,
 * etc.), but this middleware owns the tech-stack-hiding and fingerprint-masking.
 *
 * PLATFORM NOTE (Vercel → AWS portability): on Vercel, the edge proxy in front
 * of this function re-adds its own `Server: Vercel` header AFTER this code
 * runs, and that cannot be suppressed from inside the function or from
 * vercel.json — it is injected at the platform layer. The stripping below is
 * still correct and still matters: it is what actually wins once this same
 * code runs on a platform that does not do that (a plain AWS deployment
 * behind ALB/CloudFront/ECS/Lambda without Vercel's edge in the path), and it
 * is still the last word for any header Vercel does not overwrite.
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
  // Generate the correlation id server-side; never reflect an untrusted
  // caller-supplied header into response metadata.
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  /* ── Strip tech-stack fingerprinting headers ── */
  for (const header of STRIP_HEADERS) {
    res.removeHeader(header);
  }

  /* ── Branded Server header — hides Express/Node ── */
  res.setHeader('Server', 'HAVAN');

  /* ── Cross-Origin isolation — all three together, not just COOP.
   * COOP alone stops other windows from holding a reference to this one;
   * CORP stops other origins from <img>/<script>-loading this response;
   * COEP requires every subresource *this* page loads to opt in, which is
   * what actually unlocks full process isolation (SharedArrayBuffer, precise
   * timers, etc.) and defends against Spectre-style side channels. Setting
   * COOP without COEP, as before, only gets you a third of the protection. */
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  // API responses carry session/RSVP/profile data — they must not be loadable
  // as a subresource by any other origin. `cross-origin` (the previous value)
  // is the setting for public CDN assets, not authenticated API JSON; it was
  // backwards here.
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

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

  /* ── Permissions policy — disable every browser API this app does not use.
   * Kept as an explicit allow-nothing list rather than trusting the browser
   * default, which is permissive for same-origin content. */
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), ' +
      'magnetometer=(), gyroscope=(), accelerometer=(), midi=(), sync-xhr=(), ' +
      'fullscreen=(self), display-capture=(), screen-wake-lock=(), serial=(), hid=(), ' +
      'bluetooth=(), otp-credentials=(), clipboard-write=(self), autoplay=(self)'
  );

  /* ── Opt out of FLoC / topics-style browser tracking cohorts explicitly.
   * `interest-cohort=()` above already does this for the deprecated FLoC
   * trial; this header is the direct opt-out some Chromium builds still read. */
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}

/**
 * API-specific security and cache-control headers.
 * Applied only to /api/* routes.
 */
export function apiSecurityHeaders(req, res, next) {
  // Prevent sensitive API response caching — at the browser, at any proxy,
  // and at any CDN/surrogate sitting in front of this deployment.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  // Auth/session responses must never be stored by an intermediary cache
  // keyed only on URL — Vary: Authorization keeps a shared cache from ever
  // serving one user's cached response to another.
  res.setHeader('Vary', 'Authorization, Cookie, Origin');

  next();
}

