import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // 👈 加上這行！將資源路徑強制轉為相對路徑
  server: {
    port: 5173,
  },
});
