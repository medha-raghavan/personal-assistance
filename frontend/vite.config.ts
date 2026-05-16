import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // 1. FIX: Exposes Vite outside the Docker container
    allowedHosts: [
      'raspberrypi',             // Allows accessing via http://raspberrypi:3000
      'raspberrypi.tail38a9a8.ts.net'       // Allows your VS Code Server tunnel domain (notice the leading dot for wildcards)
    ],
    proxy: {
      '/api': {
        // 2. FIX: Target '127.0.0.1' instead of 'localhost' inside Docker
        target: 'http://127.0.0.1:3001', 
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
