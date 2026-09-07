import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le bundle est servi par le collecteur sur :9001,
  // pas depuis la racine d'un domaine.
  base: './',
});
