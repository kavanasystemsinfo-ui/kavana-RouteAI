import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Despliegue en GitHub Pages con dominio propio routefleet.kavanasystems.com
export default defineConfig({
  base: '/',
  plugins: [react()]
});
