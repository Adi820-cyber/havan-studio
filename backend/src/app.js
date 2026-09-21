/**
 * Express application assembly.
 *
 * This is the app factory — it wires middleware and routes but does not listen.
 * server.js imports this and calls .listen(). This separation makes it testable.
 */
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import corsMiddleware from './middleware/cors.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiSecurityHeaders } from './middleware/security.js';

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

/* ── Security ── */
app.disable('x-powered-by');
app.set('trust proxy', true); // Behind ALB/CloudFront

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://api.fontshare.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.fontshare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    hidePoweredBy: true,
  })
);

/* ── Custom Security & Cache Headers ── */
app.use('/api', apiSecurityHeaders);

/* ── Logging ── */
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    skip: (req) => req.url === '/api/health', // Don't log health checks
  })
);

/* ── CORS ── */
app.use(corsMiddleware);

/* ── Body parsing ── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ── Rate limiting ── */
app.use('/api', globalLimiter);

/* ── API Routes ── */
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
