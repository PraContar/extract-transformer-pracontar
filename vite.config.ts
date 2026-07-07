import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App 100% client-side. Saída estática em dist/ (deploy direto na Vercel, preset "Vite").
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: {
    // Nosso Web Worker (e o worker interno do pdf.js) são ESM.
    format: 'es',
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
