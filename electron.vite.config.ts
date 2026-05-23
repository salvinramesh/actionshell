import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('electron/main'),
        '@shared': resolve('shared')
      }
    },
    build: {
      lib: {
        entry: resolve('electron/main/index.ts')
      },
      rollupOptions: {
        external: ['better-sqlite3', 'bcryptjs', 'ssh2', 'node-pty', 'speakeasy', 'jsonwebtoken', 'uuid', 'qrcode', 'archiver']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/preload/index.ts')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src'),
        '@components': resolve('src/components'),
        '@features': resolve('src/features'),
        '@hooks': resolve('src/hooks'),
        '@store': resolve('src/store'),
        '@styles': resolve('src/styles'),
      }
    },
    plugins: [react()],
    root: '.',
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    }
  }
})
