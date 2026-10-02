import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Browsers detect a new service worker by comparing the bytes of /sw.js. The file never changes between code-only
// deploys, so each build prepends a unique id to it. That is what lets the app notice a new version.
function stampServiceWorker() {
  return {
    name: 'stamp-service-worker',
    closeBundle() {
      const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url))
      if (!existsSync(file)) return
      writeFileSync(file, `// build: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}\n${readFileSync(file, 'utf-8')}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  build: {
    rolldownOptions: {
      output: {
        // Long-lived vendor chunks cache across deploys; app code changes more often (Phase 10 performance).
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { environment: 'node' },
})
