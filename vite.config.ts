// Builds the desktop renderer for the browser. The renderer's sources and their dependencies come from the wevir
// checkout behind `.wevir` (scripts/setup.mjs); `@/` and `@wevir-renderer` point into it, and the workspace packages
// (`@wevir/client-sdk`, `@wevir/protocol`) resolve to their sources through the `@wevir/source` condition, as in the
// desktop build.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions, defineConfig, type Plugin } from 'vite';
import { DEVELOPMENT_CSP, PREVIEW_CSP, SECURITY_HEADERS } from './src/csp.ts';

const WEB_ROOT = import.meta.dirname;
const WEVIR = realpathSync(join(WEB_ROOT, '.wevir'));
const RENDERER = join(WEVIR, 'apps/desktop/src/renderer');
const RENDERER_SRC = join(RENDERER, 'src');

/**
 * The renderer's first-frame script (public/theme-init.js sets data-theme before styles load): served in dev and
 * emitted in the build, so wevir-web's own public/ can hold the hosting files.
 */
function rendererPublic(): Plugin {
  const files = ['theme-init.js'];
  return {
    name: 'wevir-renderer-public',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.slice(1);
        if (name === undefined || !files.includes(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css');
        res.end(readFileSync(join(RENDERER, 'public', name)));
      });
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({
          type: 'asset',
          fileName: name,
          source: readFileSync(join(RENDERER, 'public', name)),
        });
      }
    },
  };
}

export default defineConfig({
  root: WEB_ROOT,
  resolve: {
    conditions: ['@wevir/source', ...defaultClientConditions],
    alias: {
      '@wevir-renderer': join(RENDERER_SRC, 'embed.ts'),
      '@': RENDERER_SRC,
    },
    dedupe: ['react', 'react-dom'],
  },
  // Vitest runs the unit tests as SSR modules: the same condition for the workspace packages.
  ssr: { resolve: { conditions: ['@wevir/source', ...defaultServerConditions] } },
  plugins: [rendererPublic(), react(), tailwindcss()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    fs: { allow: [WEB_ROOT, WEVIR] },
    headers: { 'Content-Security-Policy': DEVELOPMENT_CSP, ...SECURITY_HEADERS },
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: { 'Content-Security-Policy': PREVIEW_CSP, ...SECURITY_HEADERS },
  },
  build: {
    target: 'es2023',
    outDir: resolve(WEB_ROOT, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    // Fonts stay separate files: font-src is 'self' only.
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    chunkSizeWarningLimit: 8000,
  },
  // The diff highlighter's worker uses dynamic import (Shiki's grammars and WASM engine).
  worker: { format: 'es' },
});
