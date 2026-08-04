import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base apunta al subpath del repo en GitHub Pages.
// En local (npm run dev) Vite lo ignora y sirve desde '/'.
export default defineConfig({
  base: '/kavana-RouteFleet/',
  plugins: [react()],
  server: {
    host: true
  }
});
