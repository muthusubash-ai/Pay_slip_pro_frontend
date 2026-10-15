import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Must match GOOGLE_REDIRECT_URI's host in backend/.env ("localhost") - the Google
    // OAuth state cookie is scoped to the exact host that set it, and browsers treat
    // "localhost" and "127.0.0.1" as different hosts despite resolving to the same IP.
    host: 'localhost',
    port: 3050,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy/stable vendor libs into their own long-lived chunks so
        // they're cached across deploys and loaded in parallel with page chunks.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('react')) return 'react-vendor';
          }
        },
      },
    },
  },
})
