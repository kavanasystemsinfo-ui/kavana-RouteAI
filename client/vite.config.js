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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](lucide-react|framer-motion)[\\/]/.test(id)) return 'vendor-ui';
          if (/[\\/]node_modules[\\/](jspdf|html2canvas)[\\/]/.test(id)) return 'vendor-pdf';
          if (/[\\/]node_modules[\\/](leaflet)[\\/]/.test(id)) return 'vendor-map';
          return undefined;
        },
      },
    },
  },
});
