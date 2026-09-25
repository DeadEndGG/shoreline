import { defineConfig } from 'vitest/config';

// Unit tests for the in-browser demo API (pure TypeScript, no Angular TestBed needed).
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
