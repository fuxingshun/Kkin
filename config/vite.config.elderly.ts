import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const projectRoot = path.resolve(__dirname, '..')
const webEntry = (file: string) => path.resolve(projectRoot, 'apps/web', file)

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: 'dist/elderly',
    rollupOptions: {
      input: {
        main: webEntry('elderly.html'),
        avatar: webEntry('elderly-avatar.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: '/apps/web/elderly.html',
  },
})
