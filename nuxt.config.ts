// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  telemetry: false,
  app: {
    head: {
      link: [
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
  }
})
