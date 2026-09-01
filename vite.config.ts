import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // 👈 加上這行！將資源路徑強制轉為相對路徑
  server: {
    port: 5173,
  },
  // concept/ 底下是美術/玩法概念的獨立 html 草稿(make_snowman.html 等)，
  // 用瀏覽器原生 importmap 指到 CDN 上的 three.js，不是給 Vite 這個
  // 專案的模組圖用的。Vite 預設會自動把專案裡「所有」*.html 都當成
  // optimizeDeps 的掃描入口，掃到這些草稿檔案裡的 three/addons/... 就
  // 會拿專案自己 node_modules 的舊版 three(0.128.0，還沒有 addons 這個
  // exports 別名)去解析，直接整個 dev server 掛掉——2026-09-01 就是
  // 這樣導致遊戲完全跑不起來、連音樂都沒聲音。明確指定唯一入口
  // index.html，concept 底下的草稿檔繼續用瀏覽器直接開就好，不會再被
  // 這個開發伺服器碰到。
  optimizeDeps: {
    entries: ["index.html"],
  },
});
