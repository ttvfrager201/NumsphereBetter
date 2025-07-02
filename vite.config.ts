import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tempo } from "tempo-devtools/dist/vite";

const conditionalPlugins: [string, Record<string, any>][] = [];

// @ts-ignore
if (process.env.TEMPO === "true") {
  try {
    conditionalPlugins.push(["tempo-devtools/swc", {}]);
  } catch (error) {
    console.warn("Failed to load tempo-devtools/swc plugin:", error);
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  optimizeDeps: {
    entries: ["src/main.tsx"],
    include: ["react", "react-dom", "react-router-dom"],
  },
  plugins: [
    react({
      plugins: conditionalPlugins.length > 0 ? conditionalPlugins : undefined,
    }),
    tempo(),
  ],
  resolve: {
    preserveSymlinks: false,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // 👈 Key: listen on all interfaces
    port: 5173, // 👈 Force 5173
    strictPort: true, // 👈 Fail if 5173 is taken (good for debugging)
    allowedHosts: process.env.TEMPO === "true" ? true : undefined,
    hmr: {
      protocol: "ws",
      host: "0.0.0.0",
      port: 5173,
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
