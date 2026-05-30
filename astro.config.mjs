import { defineConfig } from 'astro/config';

export default defineConfig({
  outDir: 'docs',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
});
