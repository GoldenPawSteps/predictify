import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': backendUrl,
      '/markets': backendUrl,
      '/trades': backendUrl,
      '/settlement': backendUrl,
      '/portfolio': backendUrl,
    }
  }
});
