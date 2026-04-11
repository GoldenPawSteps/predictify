import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BACKEND_URL is read by the Node.js Vite server process for proxy config,
// not embedded in the client bundle, so no VITE_ prefix is needed.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: Object.fromEntries(
      ['/auth', '/markets', '/trades', '/settlement', '/portfolio/'].map(route => [
        route,
        {
          target: backendUrl,
          changeOrigin: true,
          bypass: (req) => {
            const accept = req.headers['accept'] || '';
            if (accept.includes('text/html')) return '/index.html';
          },
        },
      ])
    ),
  }
});
