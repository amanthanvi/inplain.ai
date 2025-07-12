import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy as copy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    copy({
      targets: [
        { src: 'manifest.json', dest: '' },
        { src: 'public/icons/*', dest: 'public/icons' },
        { src: 'src/popup/popup.html', dest: 'src/popup' },
        { src: 'src/options/options.html', dest: 'src/options' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : ''
          const name = facadeModuleId?.replace('.ts', '.js').replace('.tsx', '.js')
          return `src/${chunkInfo.name}/${name}`
        },
        chunkFileNames: 'src/chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.name || ''
          if (fileName.endsWith('.css')) {
            return 'src/styles/[name][extname]'
          }
          return 'assets/[name][extname]'
        },
      },
    },
  },
})