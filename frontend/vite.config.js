import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Otimizações de build
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log em produção
        drop_debugger: true
      }
    },
    // Code splitting para melhor cache
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa vendor em chunks menores
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'markdown-vendor': ['react-markdown', 'remark-gfm']
        }
      }
    },
    // Aumenta o limite de aviso de chunk
    chunkSizeWarningLimit: 600,
    // Gera sourcemaps para debugging
    sourcemap: false
  },
  // Otimiza deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'lucide-react']
  },
  // Compressão
  server: {
    host: true
  }
});