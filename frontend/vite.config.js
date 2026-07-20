import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Build multi-pages : chaque interface (agent, admin, page de paiement/
// contestation par lien SMS) est une SPA indépendante, générée dans
// backend/public pour être servie directement par le serveur Express existant.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/public',
    emptyOutDir: true, // backend/public est désormais entièrement généré par ce build
    rollupOptions: {
      input: {
        agent: resolve(__dirname, 'agent.html'),
        admin: resolve(__dirname, 'admin.html'),
        payer: resolve(__dirname, 'payer.html')
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
