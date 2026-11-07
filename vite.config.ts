import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { musicIndex } from './vite-plugins/musicIndex';

export default defineConfig({
  plugins: [react(), musicIndex()],
  server: { port: 5173, strictPort: true },
});
