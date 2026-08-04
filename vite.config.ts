import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Bind mounts on Windows and macOS do not deliver inotify events, so containerised dev servers
// need polling to pick up edits made on the host.
const usePolling = process.env.VITE_DEV_POLLING === 'true';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Compose addresses these servers by service name from other containers, which Vite rejects
    // unless the name is allow-listed.
    allowedHosts: ['dev', 'localhost', '127.0.0.1'],
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['preview', 'localhost', '127.0.0.1'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10_000,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.d.ts', 'src/test/**', 'src/main.tsx'],
    },
  },
});
