import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 9002,
    proxy: {
      '/api': {
        target: 'http://localhost:9001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9001',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {})
          proxy.on('proxyReqWsError', () => {})
        },
      },
    },
  },
})
