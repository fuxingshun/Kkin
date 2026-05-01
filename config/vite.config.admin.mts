import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configDir, '..');
const webEntry = (file: string) => path.resolve(projectRoot, 'apps/web', file);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: 'dist/admin',
    rollupOptions: {
      input: {
        main: webEntry('admin.html'),
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join('/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (/\/node_modules\/(react|react-dom|scheduler|react-is)\//.test(normalizedId)) {
            return 'react-vendor';
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons';
          }

          if (/\/node_modules\/(d3-|victory-vendor|decimal\.js)/.test(normalizedId)) {
            return 'charts-vendor';
          }

          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'charts';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 3002,
    open: '/apps/web/admin.html',
  },
});
