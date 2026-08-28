import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages sub-path (https://<user>.github.io/Psychometric/).
// Override with BASE_PATH=/ when serving from a custom domain or root.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/Psychometric/',
  test: {
    // jsdom only where it is needed: hook tests carry a DOM, engine tests stay on node.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [['src/hooks/**', 'jsdom']],
  },
});
