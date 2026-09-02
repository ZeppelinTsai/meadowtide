import { gameState, TIME_CONFIG } from "./game-state";
import { DAY_TWO_MORNING_ARRIVAL } from "./layout-maps";
import { npcGroup, npcs } from "./npc-runtime";
import { loadMap } from "./build-map";
import { groundY } from "./scene-sky";
import { dialogQueue } from "./dialogue";

// ==============================================================
// 第二天早上「村長在家門口等你」——Zeppelin 2026-09-02「試試看」提出的
// 第一版強制觸發演出，用來驗證「日期+時段強制觸發、跨圖傳送＋朝向、NPC
// 固定站位＋朝向、黑幕轉場」這組組合怎麼寫。見
// docs/decisions/day-two-morning-event.md。
//
// 刻意跟 carpenter-quest.ts 的 canStartCarpenterDockScene()（同樣是
// day===1 && hour 8:00-8:30，但那邊要玩家走到碼頭「觸碰」才觸發）完全
// 分開、各自獨立觸發——這是目前唯一兩個共用同一個日期+時段窗口的事件，
// 要不要合併成一段連續演出（例如「村長來敲門 → 一起走去碼頭」）是還沒
// 拍板的敘事決定，這輪先各自獨立，不要互相干擾或搶著觸發。
// ==============================================================

export const dayTwoMorningEvent = { triggered: false, holding: false };

export function canStartDayTwoMorningEvent(): boolean {
  if (dayTwoMorningEvent.triggered) return false;
  // 對話開著／已經有其他演出鎖住時不要硬插一段跨圖傳送進去，跟
  // carpenter-quest.ts 的 handleCarpenterDockTouch() 擋 dialogQueue 是
  // 同一個理由；cutsceneActive 額外擋掉序幕還沒播完的邊界情況。
  if (dialogQueue.length || gameState.cutsceneActive) return false;
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  return gameState.currentDay === 1 && hour >= 8 && hour < 8.5;
}

export function startDayTwoMorningEvent() {
  dayTwoMorningEvent.triggered = true;
  loadMap("livingArea", DAY_TWO_MORNING_ARRIVAL.player, () => {
    // 模型鼻子朝本地 -Z，rotation.y = atan2(dx,dz)+π 是全專案統一公式
    // （見 game-loop.ts NPC 走位那段同一條註解）。面朝下(+Z，dx=0,dz=1)
    // 就是 atan2(0,1)+π = π。
    gameState.player.rotation.y = Math.PI;
    const mayor = npcs.find((n) => n.id === "mayor");
    if (mayor) {
      npcGroup.visible = true;
      mayor.mesh.visible = true;
      mayor.mesh.position.set(
        DAY_TWO_MORNING_ARRIVAL.mayor.x,
        groundY(DAY_TWO_MORNING_ARRIVAL.mayor.x, DAY_TWO_MORNING_ARRIVAL.mayor.z),
        DAY_TWO_MORNING_ARRIVAL.mayor.z,
      );
      // 面朝上(-Z，dx=0,dz=-1)：atan2(0,-1)+π = 0，跟玩家隔一格面對面。
      mayor.mesh.rotation.y = 0;
      mayor.path = null;
      mayor.lastTargetKey = null;
    }
    // holding=true 之後交給 game-loop.ts 的 NPC 排程迴圈接手固定站位
    // （見該檔案「dayTwoMorningEvent.holding」那段）——不然村長下一幀
    // 就會被日常行程表(getScheduleTarget)重新接管、直接走掉。
    dayTwoMorningEvent.holding = true;
  });
}
