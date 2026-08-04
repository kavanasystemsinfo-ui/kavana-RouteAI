import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Despliegue en GitHub Pages con dominio propio routeai.kavanasystems.com
export default defineConfig({
  base: '/',
  plugins: [react()]
});
