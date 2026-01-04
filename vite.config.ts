
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      // Vercel error shows it's looking for 'build' folder
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks for large libraries
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            'vendor-excel': ['exceljs'],
            'vendor-google': ['@google/genai'],
            'vendor-icons': ['lucide-react'],
            'vendor-utils': ['date-fns']
          }
        }
      },
      chunkSizeWarningLimit: 1000 // Increase warning limit to 1MB
    },
    define: {
      // Expose Keys to the client-side code safely
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.API_KEY_GROQ': JSON.stringify(env.API_KEY_GROQ),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
      // Polyfill process.env to avoid crashes in some libs that expect it
      'process.env': JSON.stringify(env)
    }
  };
});
