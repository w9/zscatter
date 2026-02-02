import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "ZScatter",
      fileName: (format) => (format === "cjs" ? "index.cjs" : "index.js"),
      formats: ["es", "cjs"]
    },
    rollupOptions: {
      external: ["react", "react-dom", "three", "@react-three/fiber"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          three: "THREE",
          "@react-three/fiber": "ReactThreeFiber"
        }
      }
    }
  }
});
