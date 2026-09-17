import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/准备.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
