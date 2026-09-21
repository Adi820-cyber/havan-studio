import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server no longer mounts a local API. The app talks directly to
// Supabase, so there is nothing to proxy and no JSON file to guard against the
// file watcher.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/Sufi-music/**', '**/house_party/**']
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Split the vendor libraries out of the app bundle. Without this the
        // single chunk crosses 500 kB once the Supabase client is included.
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'canvas-confetti', 'qrcode']
        }
      }
    }
  }
});
