import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/scans': 'http://localhost:8000',
      '/patients': 'http://localhost:8000',
      '/doctor/reviews': 'http://localhost:8000',
      '/notifications': 'http://localhost:8000',
      '/admin/audit-logs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
      '/admin/monitoring': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // The same path serves the React page and monitoring JSON API.
        bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : undefined,
      },
    },
  },
})
