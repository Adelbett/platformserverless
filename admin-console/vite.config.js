import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Admin console dev server — deliberately different from web-portal's
    // 5173, so both can run side by side locally.
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      }
    }
  }
})
