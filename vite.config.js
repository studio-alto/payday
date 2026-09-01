import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png'],
      workbox: {
        // ExcelJS (~250KB gzipped) only backs the "Descargar resumen (Excel)"
        // button — excluded from the offline precache so it doesn't triple the
        // install/update download for people who never use that one action; it's
        // fetched from the network the one time it's actually needed.
        globIgnores: ['**/exportExcel-*.js'],
      },
      manifest: {
        name: 'Payday',
        short_name: 'Payday',
        description: 'Tu dinero, cada día — asistente financiero para ingresos variables.',
        theme_color: '#FF5A36',
        background_color: '#F5F5F6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
