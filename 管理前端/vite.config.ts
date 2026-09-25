import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { 源码指纹 } from './src/构建指纹.ts';

interface 分块度量 {
  名称: string;
  字节数: number;
  gzip字节数: number;
}

function 体积统计插件(): Plugin {
  const 清单: 分块度量[] = [];
  let 产物目录 = '';
  return {
    name: 'lianai-build-stats',
    apply: 'build',
    writeBundle(options, bundle) {
      产物目录 = options.dir ?? 产物目录;
      for (const [名称, 产物] of Object.entries(bundle)) {
        if (产物.type !== 'chunk' && 产物.type !== 'asset') {
          continue;
        }
        const 内容 = typeof 产物.source === 'string' ? 产物.source : 产物.code;
        const 字节 = Buffer.byteLength(内容, 'utf8');
        清单.push({ 名称, 字节数: 字节, gzip字节数: gzipSync(内容, { level: 9 }).length });
      }
    },
    closeBundle() {
      if (产物目录.length === 0) {
        return;
      }
      const 统计 = { 清单, 源码指纹: 源码指纹() };
      writeFileSync(resolve(产物目录, 'build-stats.json'), `${JSON.stringify(统计, null, 2)}\n`, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [vue(), 体积统计插件()],
  build: {
    modulePreload: { polyfill: false },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5175,
    https: process.env.VITE_DEV_HTTPS === '1' ? {} : undefined,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5175,
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost:5175/' },
    },
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
