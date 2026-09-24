import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Forwards /api/* to the Express backend, so in dev the browser sees
      // the admin panel and the API as ONE origin. That's what lets the
      // httpOnly, SameSite=Strict session cookie work without any CORS
      // setup. Point API_PROXY_TARGET (in admin/.env) somewhere else if the
      // backend isn't on port 3000.
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
