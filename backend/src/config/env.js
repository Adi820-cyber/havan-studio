/**
 * Centralised environment variable validation.
 *
 * Called once at startup. Fails fast with a readable error for any missing
 * required variable rather than surfacing cryptic runtime errors later.
 *
 * AWS S3 variables are optional — uploads will return a friendly error if
 * they are not configured. This lets you deploy on Vercel (or locally)
 * without needing an S3 bucket right away.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from the backend root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
// Fallback to .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/* ── required ── */

const REQUIRED = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  const msg = `Missing required environment variables: ${missing.join(', ')}. ` +
    'Set them in Vercel Dashboard → Settings → Environment Variables, or in backend/.env.local for local dev.';
  console.error(`\n❌  ${msg}\n`);
  // On Vercel, process.exit kills the function silently. Throw instead so
  // the error message reaches the client via the error handler.
  if (process.env.VERCEL) {
    throw new Error(msg);
  }
  process.exit(1);
}

/* ── optional: AWS S3 ── */

const AWS_KEYS = ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
const awsMissing = AWS_KEYS.filter((k) => !process.env[k]);
const awsConfigured = awsMissing.length === 0;

if (!awsConfigured) {
  console.warn(`\n⚠️  AWS S3 not configured (missing: ${awsMissing.join(', ')})`);
  console.warn('   Cover image uploads will be disabled.\n');
}

/* ── export ── */

const NODE_ENV = process.env.NODE_ENV || 'development';

// Whether routes are allowed to fall back to the in-memory localStore when a
// real Supabase call fails.
//
// This used to be implicit: every route with a try/catch around a Supabase
// call fell back to localStore on ANY failure — wrong credentials, RLS
// denial, a typo in an RPC name, Supabase being genuinely down, all treated
// identically and all silently hidden from the caller. On Vercel specifically
// that is not a graceful degradation, it is data loss: each serverless
// invocation can get a fresh, empty localStore, so a "successful" signup or
// RSVP served from the fallback on one invocation is invisible to the next.
//
// `NODE_ENV === 'production'` always wins here, even if USE_LOCAL_FALLBACK is
// left set to something truthy in a production environment by mistake — this
// is deliberately not just "off by default", it is "impossible to turn on in
// prod", because the failure mode it enables is silent by design and would be
// very hard to notice happening again.
export const USE_LOCAL_FALLBACK = NODE_ENV !== 'production' && process.env.USE_LOCAL_FALLBACK === 'true';

const env = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV,

  // CORS — comma-separated list of allowed origins
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3001', 'http://localhost:5173', 'https://havanv2.vercel.app', 'http://havanv2.vercel.app'],

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  HAS_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),

  // AWS S3 (optional — may be empty strings)
  AWS_CONFIGURED: awsConfigured,
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
};

export default env;

