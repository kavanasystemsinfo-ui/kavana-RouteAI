import { CapacitorConfig } from '@capacitor/core';

// Configuracion de Capacitor para empaquetar la PWA del repartidor como APK nativo.
// La WebView carga los assets locales embebidos (dist/), no la PWA remota,
// asi el APK es autonomo y no depende del despliegue de la web.
// VITE_API_BASE se inyecta en el build del APK via repo secret.
const config: CapacitorConfig = {
  appId: 'com.kavanasystems.routefleet',
  appName: 'RouteFleet',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
