import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/v1": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
});
