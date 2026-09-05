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
      name: "prerendered-routes-preview",
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          const requestUrl = req.url ?? "";
          const queryStart = requestUrl.indexOf("?");
          const pathOnly =
            queryStart === -1 ? requestUrl : requestUrl.slice(0, queryStart);
          const query = queryStart === -1 ? "" : requestUrl.slice(queryStart);

          if (pathOnly === "/privacy" || pathOnly === "/privacy/") {
            req.url = `/privacy/index.html${query}`;
          } else if (
            pathOnly === "/prophecy" ||
            pathOnly === "/prophecy/"
          ) {
            req.url = `/prophecy/index.html${query}`;
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
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@supabase")) {
            return "supabase-vendor";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "query-vendor";
          }
          if (id.includes("node_modules/framer-motion")) {
            return "motion-vendor";
          }
          if (id.includes("node_modules/recharts")) {
            return "charts-vendor";
          }
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/lucide-react")) {
            return "ui-vendor";
          }
        },
      },
    },
    // Keep the stricter threshold so regressions remain visible in local and CI builds.
    chunkSizeWarningLimit: 300,
  },
}));
