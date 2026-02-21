import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import fs from 'fs';

// Função para ler a versão do package.json
const getAppVersion = () => {
  try {
    const packageJson = fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8');
    return JSON.parse(packageJson).version;
  } catch (e) {
    console.error("Could not read package.json version:", e);
    return '0.0.0';
  }
};

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(getAppVersion()),
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    VitePWA({
      // ... (restante da config PWA)
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB (default is 2MB)
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'DIRECT AI - Gestão de Vendas',
        short_name: 'DIRECT AI',
        description: 'Seu assistente de vendas inteligente da DIRECT DTF. Gerencie pedidos, clientes e produtos com IA.',
        theme_color: '#FFF200',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/dashboard',
        categories: ['business', 'productivity', 'sales'],
        icons: [
          {
            src: 'logo.png',
            sizes: '72x72',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '152x152',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Desabilita source maps em produção para ocultar código original
    sourcemap: false,
    // Minificação agressiva com remoção de console.log
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove TODOS os console.log/info/warn
        drop_debugger: true, // Remove debugger statements
      },
      mangle: {
        safari10: true,
      },
    },
    // Otimizações adicionais
    rollupOptions: {
      output: {
        // Nomes ofuscados para chunks
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select'],
        },
      },
    },
  },
}));