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
            { src: '/99care-favicon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
            { src: '/99care-favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
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
      strictPort: true,
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
    define: {
      'import.meta.env.VITE_APP_MODE': JSON.stringify(appMode),
    },
    build: {
      outDir: process.env.VERCEL ? 'dist' : (appMode === 'os' ? 'dist-os' : 'dist-public'),
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // PDF & canvas libs — only needed in billing/reports, load lazily
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdf-parse')) {
              return 'pdf-libs';
            }
            // Charting — check BEFORE react to avoid circular dependency
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
              return 'charts';
            }
            // Animation lib
            if (id.includes('framer-motion')) {
              return 'animation';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            // Supabase client
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            // React core — checked last so recharts doesn't get pulled in
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    plugins: [
      inspectAttr(),
      react(),
      ViteImageOptimizer({
        // Compress PNGs → WebP (60-80% smaller, same quality)
        png: { quality: 82 },
        jpeg: { quality: 82 },
        jpg: { quality: 82 },
        webp: { lossless: false, quality: 82 },
        svg: {
          plugins: [
            { name: 'removeViewBox', active: false },
            { name: 'cleanupNumericValues', active: true },
          ],
        },
        logStats: true,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: pwaManifest as any,
        devOptions: {
          enabled: false, // Disable SW in dev to prevent stale cache issues
        },
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
