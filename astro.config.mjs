// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // en Vercel toma el dominio de producción del proyecto; SITE_URL lo pisa si hay un dominio propio
  site:
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://tomascardozo.vercel.app'),
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  // la escena de Kora (three.js) es un pedazo grande a propósito: se carga sola, después de la primera pintura
  vite: { build: { chunkSizeWarningLimit: 700 } },
});
