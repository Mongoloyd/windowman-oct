import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "privacy-prerender-preview",
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          const pathOnly = req.url?.split("?")[0] ?? "";

          if (pathOnly === "/privacy" || pathOnly === "/privacy/") {
            req.url = "/privacy/index.html";
          }

          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    modulePreload: {
      resolveDependencies(_url: string, deps: string[]) {
        return deps.filter((dep) => !dep.includes('admin-') && !dep.includes('partner-'));
      },
    },
    // Code splitting for better mobile FCP on Facebook traffic
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
          if (id.includes('node_modules/recharts')) {
            return 'charts';
          }
          if (id.includes('src/pages/Admin') || id.includes('src/components/admin/')) {
            return 'admin';
          }
          if (id.includes('src/pages/Partner') || id.includes('src/pages/Contractor') || id.includes('src/components/partner/')) {
            return 'partner';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/lucide-react')) {
            return 'ui';
          }
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack')) {
            return 'state';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
        },
      },
    },
    // Increase limit since we're code-splitting intentionally
    chunkSizeWarningLimit: 300,
  },
}));
