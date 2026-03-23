import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // All /api/* calls go to the FastAPI backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // SSE streaming: disable buffering
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        },
      },
    },
  },
  build: {
    // On Vercel: output to dist/ (Vercel reads from here via vercel.json outputDirectory)
    // On Railway/local: output to ../backend/static/dist (served by FastAPI)
    outDir: process.env.VERCEL ? 'dist' : '../backend/static/dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          markdown: ['react-markdown', 'remark-gfm'],
          icons:    ['lucide-react'],
        },
      },
    },
  },
})
