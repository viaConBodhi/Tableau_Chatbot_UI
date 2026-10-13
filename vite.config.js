import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // Tableau Desktop 2025.1's installed Qt webview embeds Chromium 87.
  build: { target: 'chrome87' },
  server: { host: 'localhost', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    clearMocks: true,
    maxWorkers: 2,
    pool: 'vmThreads',
  },
});
