import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La app del repartidor vive en /app/ bajo el dominio de la Torre de Control.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'framer-motion'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-map': ['leaflet'],
        },
      },
    },
  },
});
