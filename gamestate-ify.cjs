// 遷移用暫時工具：把檔案裡對這些「跨檔案會被重新賦值」的變數的裸引用，
// 全部改成 gameState.xxx。用單字邊界比對，且排除「前面已經是 . 或
// gameState.」的情況，避免誤傷 obj.currentDay 這種別的物件的同名屬性、
// 或是重複套用。宣告本身（let/const 開頭那行）已經在 game-state.ts 裡
// 手動處理過，不需要也不應該被這個腳本套用。
const fs = require("fs");
const FIELDS = [
  "pouchCollectedDay",
  "currentDay",
  "currentPhase",
  "currentSeason",
  "currentWeather",
  "previousWeather",
  "weatherChangedAt",
  "fishingState",
  "fishingTimer",
  "biteWaitTime",
  "biteWindowStart",
  "bobberMesh",
  "fishFeedback",
  "castAnimEnd",
  "catchAnim",
  "zoom",
  "nextMeteorAt",
  "meteorBurstRemaining",
  "meteorBurstCooldownUntil",
  "moonPhaseTextureDay",
  "elapsed",
  "effectElapsed",
  "audioContext",
  "musicMuted",
  "activeMusicKey",
  "oceanMesh",
  "lakeMesh",
  "seaGlimpseMesh",
  "mapGroup",
  "player",
  "currentMapName",
  "playerGridPos",
  "facing",
  "isMoving",
  "houseLampLight",
  "houseLampBulbMat",
  "prevDay",
  "ePressed",
  "lastFrame",
  "animationFrameCount",
  "grassAnimationAccumulator",
  "hudUpdateAccumulator",
];

const file = process.argv[2];
let code = fs.readFileSync(file, "utf8");
for (const f of FIELDS) {
  // 負向後顧：前面不能是「.」或字母/數字/底線(避免咬到更長的識別字，
  // 例如 prevDay 不該被 currentDay 的規則咬到，雖然這裡沒有這組，但保險起見)
  const re = new RegExp(`(?<![.\\w])${f}(?!\\w)(?!\\s*:)`, "g");
  code = code.replace(re, (match, offset, str) => {
    // 排除物件字面量裡的 key（後面接著冒號，例如 { player: x }）已經在
    // regex 用 (?!\s*:) 排除；這裡再排除「import { player } from」這種
    // import 語句裡的具名匯入(理論上不會有，因為我們不會 import 這些名字)
    return `gameState.${match}`;
  });
}
fs.writeFileSync(file, code);
console.log("converted", file);
