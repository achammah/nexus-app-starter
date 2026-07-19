import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: vite on 5173 proxies /api to the mock/real backend on 4000.
// Prod: `vite build` → dist/, served by server/server.mjs (one code path for data:
// the UI always fetches RELATIVE /api).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4000" },
  },
  build: { outDir: "dist" },
});
