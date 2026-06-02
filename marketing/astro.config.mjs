// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// GitHub Pages setup for isolated subfolder deploy.
// The marketing site lives ONLY in this folder. Astro base handles /orbit-ai subpath on Pages.
// A dedicated workflow builds ONLY this and deploys — Electron root commands stay 100% for the desktop app.
export default defineConfig({
  site: 'https://jayakrishnanps.github.io',
  base: '/orbit-ai',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['lucide-react']
    },
    optimizeDeps: {
      include: ['lucide-react']
    }
  }
});