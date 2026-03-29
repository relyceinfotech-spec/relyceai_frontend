import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [
    tailwindcss(),
    react({ fastRefresh: true })
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          router: ['react-router-dom'],
          ui: ['lucide-react', 'react-hot-toast', 'framer-motion'],
          nivo: ['@nivo/bar', '@nivo/line', '@nivo/pie', '@nivo/core'],
          xlsx: ['xlsx'],
          grid: ['ag-grid-react', 'ag-grid-community'],
          syntax: ['react-syntax-highlighter', 'refractor'],
        }
      }
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true }
    }
  },

  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom',
      'firebase/app', 'firebase/auth', 'firebase/firestore',
      'lucide-react', 'framer-motion'
    ],
    exclude: ['@gsap/react'],
    esbuildOptions: { target: 'esnext' }
  },

  server: {
    strictPort: true,
    port: 5173,
    hmr: {
      overlay: {
        errors: (error) => {
          const msg = error.message || '';
          return !(msg.includes('ECONNREFUSED') || msg.includes('ws proxy error') || msg.includes('WebSocket'));
        }
      }
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        configure: (proxy) => proxy.on('error', () => {})
      },
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => proxy.on('error', () => {})
      }
    }
  }
})
