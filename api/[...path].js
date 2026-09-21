/**
 * Vercel Serverless Function — wraps the Express backend.
 *
 * Vercel auto-detects files in /api/ as serverless functions. This catch-all
 * handler forwards every /api/* request to the Express app, so all backend
 * routes (auth, events, profiles, etc.) work without separate hosting.
 *
 * The [...path] filename is Vercel's catch-all convention — it matches
 * /api/anything/here.
 */
import app from '../backend/src/app.js';

export default app;
