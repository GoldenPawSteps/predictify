import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BACKEND_URL is read by the Node.js Vite server process for proxy config,
// not embedded in the client bundle, so no VITE_ prefix is needed.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': backendUrl,
      '/markets': backendUrl,
      '/trades': backendUrl,
      '/settlement': backendUrl,
      '/portfolio/': backendUrl,
    }
  }
});
