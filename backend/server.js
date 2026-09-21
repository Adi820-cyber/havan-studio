/**
 * HAVAN Studio — Backend API server entry point.
 *
 * Loads environment configuration (which validates required vars) and
 * starts the Express application.
 */

// env.js must be imported first — it calls dotenv.config() and validates.
import env from './src/config/env.js';
import app from './src/app.js';

const PORT = env.PORT;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🪔  HAVAN Studio API listening on port ${PORT}`);
  console.log(`   → Health:  http://localhost:${PORT}/api/health`);
  console.log(`   → Auth:    http://localhost:${PORT}/api/auth/*`);
  console.log(`   → Events:  http://localhost:${PORT}/api/events/*`);
  console.log(`   → SSE:     http://localhost:${PORT}/api/sse/*`);
  console.log(`   → Env:     ${env.NODE_ENV}`);
  console.log(`   → Node:    ${process.version}\n`);
});
