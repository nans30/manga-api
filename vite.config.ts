import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { app } from './server/app';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ciaran-mangadex-api',
      configureServer(server) {
        server.middlewares.use(app);
      },
      configurePreviewServer(server) {
        server.middlewares.use(app);
      },
    },
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('mangadex-cache.json')) {
            return 'initial-cache';
          }
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('zod')) {
              return 'vendor-zod';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
});
