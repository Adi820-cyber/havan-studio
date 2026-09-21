/**
 * Security headers and Cache-Control middleware for API routes.
 */

export function apiSecurityHeaders(req, res, next) {
  // Prevent sensitive API response caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Anti-sniffing & framing safeguards
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Strip/mask Server fingerprinting headers
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
}
