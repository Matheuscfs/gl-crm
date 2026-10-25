import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a versão nova espera a pessoa tocar em Atualizar (antes recarregava sozinha e
      // fechava um formulário aberto no meio)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'logo-gl.png'],
      manifest: {
        name: 'GL · Dra. Gabriela Lorenzi — CRM',
        short_name: 'GL CRM',
        description: 'CRM odontológico — agenda, pacientes, financeiro, estoque e documentos.',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        background_color: '#f6f5f9',
        theme_color: '#f6f5f9',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        // dados do Supabase nunca passam pelo cache — sempre rede
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-woff',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // só o 3D (Three.js, ~580 KB) passa de 500 KB, e ele já carrega sob demanda na aba Odontograma
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // bibliotecas mudam pouco: em pacotes próprios, o celular só baixa de novo o código do app
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@remix-run)[\\/]/.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
        },
      },
    },
  },
})
