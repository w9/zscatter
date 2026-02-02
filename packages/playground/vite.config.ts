import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@zscatter/zscatter": path.resolve(__dirname, "../zscatter/src/index.ts")
    }
  },
  server: {
    proxy: {
      "/stream": "http://localhost:8080"
    }
  }
});
