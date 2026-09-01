未使用/待清理檔案，這裡的內容都不影響遊戲執行。這台裝置這個 session
沒有刪檔權限，先搬進來等 Zeppelin 自己確認後刪除。

- `story-chapters-prologue-stale-copy.ts`（2026-09-01 搬入）：
  `src/story/chapters/prologue.ts` 的舊快照，內容是 `src/prologue.ts`
  某個更早版本的複製，`story-registry.ts` 明確註解過這個路徑「是舊檔，
  不是 StoryEvent 資料」，且全專案沒有任何檔案 import 它（已用
  grep 確認）。真正在跑的序章程式碼是 `src/prologue.ts`，這份只是
  廢棄快照，安全可刪。詳見 `docs/decisions/event-system.md`。
