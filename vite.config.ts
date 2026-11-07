import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { soundIndex } from './vite-plugins/soundIndex';

export default defineConfig({
  plugins: [react(), soundIndex()],
  server: { port: 5173, strictPort: true },
});
