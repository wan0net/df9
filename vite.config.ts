import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/df9/' : './',
  build: {
    rollupOptions: {
      input: {
        site: resolve(process.cwd(), 'index.html'),
        game: resolve(process.cwd(), 'game.html'),
      },
    },
  },
});
