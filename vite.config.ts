import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { VitePWA } from 'vite-plugin-pwa'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appModeRaw = process.env.VITE_APP_MODE ?? env.VITE_APP_MODE;
  const appMode = appModeRaw === 'os' ? 'os' : 'public';

  const themeColor = '#1aa6a8'; // 99 Care logo teal

  const pwaManifest =
    appMode === 'os'
      ? {
          name: '99Care OS — Private Portal',
          short_name: '99Care OS',
          description: 'Private client operations portal for 99Care',
          theme_color: themeColor,
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
          shortcuts: [
            { name: 'Open Dashboard', url: '/admin', description: 'Go to 99Care OS dashboard' },
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
              src: '/favicon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/favicon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
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
      sourcemap: true, minify: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Only split out heavy PDF libs, let Vite handle React & charts automatically to prevent circular chunk errors
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdf-parse')) {
              return 'pdf-libs';
            }
          }
        },
      },
    },
    plugins: [
      inspectAttr(),
      react(),
      ViteImageOptimizer({
        // Compress PNGs/JPEGs — SVG optimization disabled (svgo not in lockfile)
        png: { quality: 82 },
        jpeg: { quality: 82 },
        jpg: { quality: 82 },
        webp: { lossless: false, quality: 82 },
        logStats: true,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: pwaManifest as any,
        devOptions: {
          enabled: false, // Disable SW in dev to prevent stale cache issues
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB limit
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
