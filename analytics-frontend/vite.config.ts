import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(模块: string) {
          if (模块.includes('echarts')) return 'echarts'
          if (
            模块.includes('react') ||
            模块.includes('axios') ||
            模块.includes('zustand')
          ) {
            return 'react厂商'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
