import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vercel by default often looks for 'build' or 'dist'. 
    // Given the error message, setting this to 'build' ensures compatibility.
    outDir: 'build', 
  },
  define: {
    // This allows using process.env.API_KEY in the code without crashing in the browser
    'process.env': process.env
  }
});