// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  telemetry: false,
  app: {
    head: {
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', href: '/app-icon-192.png' },
        { rel: 'apple-touch-icon', href: '/app-icon-192.png' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    server: {
      strictPort: true,
      host: '0.0.0.0',
      port: 3000,
      hmr: {
        protocol: 'ws',
        host: '0.0.0.0',
        port: 5183
      }
    }
  },
  pwa: {
    devOptions: {
      enabled: false
    },
    registerType: 'autoUpdate',
    manifest: {
      name: 'RankDB',
      short_name: 'RankDB',
      description: 'Track your Overwatch account ranks and currencies.',
      theme_color: '#111827',
      background_color: '#030712',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: '/app-icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: '/app-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
    }
  }
})
