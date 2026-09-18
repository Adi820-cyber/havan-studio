/**
 * Static host for the built SPA.
 *
 * This used to also mount a hand-rolled API backed by data/database.json. That
 * is gone: the browser talks to Supabase directly, and authorization is enforced
 * by Row Level Security in the database rather than by this process.
 *
 * Consequences worth knowing:
 *   - There is no application state on this filesystem any more, so a redeploy
 *     or a restart no longer destroys users, events or RSVPs. The old JSON store
 *     was ephemeral on Render and silently reset to whatever was last committed.
 *   - This process holds no secrets. The browser uses the publishable key, and
 *     the service_role key is not part of this project.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const distPath = path.resolve(__dirname, 'dist');

// Basic hardening for a static host.
app.disable('x-powered-by');

app.use(
  express.static(distPath, {
    setHeaders(res, filePath) {
      // Hashed asset filenames can be cached hard; index.html must not be.
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// SPA fallback so /invite/:slug deep links resolve to the app shell.
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🪔 HAVAN Studio is live!`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   → Backend: Supabase (see .env.local)\n`);
});
