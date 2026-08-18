import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // In development the API is same-origin through this proxy, so
    // VITE_API_URL is left unset and the client falls back to /api.
    proxy: {
      '/api': { target: 'http://backend:3001', changeOrigin: true },
    },
  },
});
