import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const projectRoot = path.resolve(__dirname, '..')
const webEntry = (file: string) => path.resolve(projectRoot, 'apps/web', file)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: 'dist/family',
    rollupOptions: {
      input: {
        main: webEntry('family.html'),
      },
    },
  },
  server: {
    port: 3001,
    open: '/apps/web/family.html',
  },
})
