import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@mock-deliverect': path.resolve(__dirname, 'packages/mock-deliverect/src'),
    },
  },
});
