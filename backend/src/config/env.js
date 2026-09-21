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
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\n❌  Missing required environment variables:\n`);
  missing.forEach((k) => console.error(`   • ${k}`));
  console.error('\n   Create a .env.local file in backend/ with these keys.\n');
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

const env = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // CORS — comma-separated list of allowed origins
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:3001', 'http://localhost:5173', 'https://havanv2.vercel.app', 'http://havanv2.vercel.app'],

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,

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

