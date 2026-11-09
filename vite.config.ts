import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/chatdos/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/chatdos/',
          name: 'ChatDos',
          short_name: 'ChatDos',
          description: 'PWA de mensajería privada solo para 2 personas con cifrado de extremo a extremo.',
          theme_color: '#003A73',
          background_color: '#F2F4F7',
          display: 'standalone',
          start_url: '/chatdos/#/login',
          scope: '/chatdos/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
          globIgnores: ['push-sw.js'],
          importScripts: ['push-sw.js'],
          // Copias para usar sin internet (los archivos del chat se guardan cifrados)
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'chatdos-fuentes-css' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'chatdos-fuentes',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Fotos, videos y audios del chat: cada archivo tiene su propio nombre, no cambian
              urlPattern: /\/storage\/v1\/object\/(authenticated\/)?media\//,
              handler: 'CacheFirst',
              method: 'GET',
              options: {
                cacheName: 'chatdos-archivos',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Fotos de perfil: se muestra la guardada y se actualiza por detrás
              urlPattern: /\/storage\/v1\/object\/(authenticated\/)?profile\//,
              handler: 'StaleWhileRevalidate',
              method: 'GET',
              options: {
                cacheName: 'chatdos-perfiles',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
