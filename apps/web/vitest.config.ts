import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/test/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@petiatrics/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      '@petiatrics/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
});
