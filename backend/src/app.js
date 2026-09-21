/**
 * Express application assembly.
 *
 * This is the app factory — it wires middleware and routes but does not listen.
 * server.js imports this and calls .listen(). This separation makes it testable
 * and allows Vercel to import the app as a serverless function.
 */
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { securityProxy, apiSecurityHeaders } from './middleware/security.js';
import corsMiddleware from './middleware/cors.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import rsvpRoutes from './routes/rsvp.js';
import commentRoutes from './routes/comments.js';
import profileRoutes from './routes/profiles.js';
import uploadRoutes from './routes/upload.js';
import inviteeRoutes from './routes/invitees.js';
import sseRoutes from './routes/sse.js';
import dashboardRoutes from './routes/dashboard.js';
import healthRoutes from './routes/health.js';

const app = express();

/* ── 1. Security Proxy — FIRST middleware ── */
// Strips tech-stack headers (Server, X-Powered-By), adds request ID,
// sets COOP/CORP, Permissions-Policy, Referrer-Policy, X-Frame-Options.
app.disable('x-powered-by');
app.set('trust proxy', true); // Behind ALB/CloudFront/Vercel
app.use(securityProxy);

/* ── 2. Helmet — additional hardening ── */
// Our securityProxy already handles: X-Powered-By, X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, X-DNS-Prefetch-Control.
// Helmet adds: CSP via HTTP header (where frame-ancestors works!), HSTS.
app.use(
  helmet({
    // CSP via HTTP header — frame-ancestors works here (not in <meta> tags)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://vercel.live"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://api.fontshare.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.fontshare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameAncestors: ["'none'"],  // ← works in HTTP header, not <meta>
      },
    },
    // HSTS
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // These are already handled by securityProxy — disable helmet's versions
    // to avoid duplicate/conflicting headers
    frameguard: false,           // securityProxy sets X-Frame-Options
    xPoweredBy: false,           // securityProxy strips it
    noSniff: false,              // securityProxy sets X-Content-Type-Options
    referrerPolicy: false,       // securityProxy sets Referrer-Policy
    dnsPrefetchControl: false,   // securityProxy sets X-DNS-Prefetch-Control
    xssFilter: false,            // securityProxy sets X-XSS-Protection: 0
    // Let our middleware handle cross-origin policies
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
  })
);

/* ── 3. API-specific Cache-Control ── */
app.use('/api', apiSecurityHeaders);

/* ── 4. Logging ── */
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    skip: (req) => req.url === '/api/health', // Don't log health checks
  })
);

/* ── 5. CORS ── */
app.use(corsMiddleware);

/* ── 6. Body parsing ── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ── 7. Rate limiting ── */
app.use('/api', globalLimiter);

/* ── 8. API Routes ── */
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/invitees', inviteeRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/dashboard', dashboardRoutes);

/* ── 404 for unmatched API routes ── */
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

/* ── Error handler (must be last) ── */
app.use(errorHandler);

export default app;

