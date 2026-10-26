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
});
