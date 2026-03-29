import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tauri dev server config
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Allow cross-origin requests from Tauri
    host: 'localhost',
  },
  // Env variables starting with VITE_ are safe (no secrets)
  envPrefix: ['VITE_'],
  build: {
    // Produce sourcemaps for debugging
    sourcemap: true,
    // Don't inline assets (Tauri serves them)
    assetsInlineLimit: 0,
    target: 'esnext',
    minify: false,
  },
})
