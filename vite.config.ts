import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appModeRaw = process.env.VITE_APP_MODE ?? env.VITE_APP_MODE;
  const appMode = appModeRaw === 'os' ? 'os' : 'public';

  const themeColor = '#1aa6a8'; // 99 Care logo teal

  const pwaManifest =
    appMode === 'os'
      ? {
          name: 'HealthFirst OS — Private Portal',
          short_name: 'HealthFirst OS',
          description: 'Private client operations portal',
          theme_color: themeColor,
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/99care-favicon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
            { src: '/99care-favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
          shortcuts: [
            { name: 'Open Dashboard', url: '/admin', description: 'Go to HealthFirst OS dashboard' },
          ],
        }
      : {
          name: '99 Care — Home Healthcare Services',
          short_name: '99 Care',
          description: 'Professional home healthcare services in Surat, Gujarat',
          theme_color: themeColor,
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'https://99care.org/wp-content/uploads/2024/01/99care-logo.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: 'https://99care.org/wp-content/uploads/2024/01/99care-logo.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
          shortcuts: [
            { name: 'Book Appointment', url: '/appointment', description: 'Book a home healthcare appointment' },
            { name: 'Our Services', url: '/services', description: 'View all healthcare services' },
            { name: 'Contact Us', url: '/contact', description: 'Get in touch with 99 Care' },
          ],
        };

  return {
    base: '/',
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(appMode),
    },
    build: {
      outDir: appMode === 'os' ? 'dist-os' : 'dist-public',
      emptyOutDir: true,
    },
    plugins: [
      inspectAttr(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: pwaManifest as any,
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB limit
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'google-fonts' },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
