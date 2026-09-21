/**
 * CORS configuration middleware.
 *
 * In development allows localhost origins. In production reads from
 * CORS_ORIGINS env variable (comma-separated list of allowed origins).
 */
import cors from 'cors';
import env from '../config/env.js';

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (env.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // In development mode, check localhost patterns
    if (env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400, // 24 hours preflight cache
};

export default cors(corsOptions);

