import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    build: {
      // Vercel error shows it's looking for 'build' folder
      outDir: 'build',
    },
    define: {
      // Expose API_KEY to the client-side code safely
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env to avoid crashes in some libs
      'process.env': {}
    }
  };
});