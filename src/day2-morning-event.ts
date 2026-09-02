import { gameState, TIME_CONFIG, dayLength } from "./game-state";
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
// 拍板的敘事決定，通輪先各自獨立，不要互相干擾或搶著觸發。
//
// 2026-09-02 第二輪：Zeppelin 反饋「避免強制事件被跳過」——睡覺(或 N
// 鍵快轉)一次跳好幾小時是單一幀內的瞬間賦值(見 game-clock.ts
// updateGameClock() 的說明)，如果剛好整段跳過 [8:00, 8:30) 這個窗口
// （例如在第二天 06:00～08:00 之間又睡了一次「休息到今天傍晚六點」），
// 下面 canStartDayTwoMorningEvent() 這種只看「現在這一刻是否落在窗口
// 內」的檢查永遠不會抓到，這個事件就會被永久跳過。加了 `due` 這個旗標：
// game-clock.ts 的 updateGameClock() 每次推進時間都會比較「這次前進的
// elapsed 區間」有沒有含到這個窗口（不是比較 currentPhase 前後值，道理
// 跟同檔案既有的 crossedAutosaveMark() 一樣），含到就把 due 設成
// true——跟 gameState.pendingAutosave 同一種分工：底層時鐘只負責標記，
// 真正觸發（含 dialogQueue/cutsceneActive 這些畫面狀態判斷）留給這裡
// 自己的 canStartDayTwoMorningEvent()，不從 game-clock.ts 裡直接呼叫
// startDayTwoMorningEvent()，避免在不恰當的畫面狀態下硬插一段跨圖傳送。
// ==============================================================

export const dayTwoMorningEvent = { triggered: false, holding: false, due: false };

// 窗口本身用絕對 elapsed 表示（day===1、hour∈[8,8.5)），跟
// game-clock.ts 的 crossedAutosaveMark() 用同一種算法，讓
// game-clock.ts 可以直接拿來跟前後兩次 elapsed 比較區間、不用重複定義。
export const DAY_TWO_MORNING_WINDOW_START = dayLength * (1 + 8 / 24);
export const DAY_TWO_MORNING_WINDOW_END = dayLength * (1 + 8.5 / 24);

export function canStartDayTwoMorningEvent(): boolean {
  if (dayTwoMorningEvent.triggered) return false;
  // 對話開著／已經有其他演出鎖住時不要硬插一段跨圖傳送進去，跟
  // carpenter-quest.ts 的 handleCarpenterDockTouch() 擋 dialogQueue 是
  // 同一個理由；cutsceneActive 額外擋掉序幕還沒播完的邊界情況。
  if (dialogQueue.length || gameState.cutsceneActive) return false;
  // due 為真代表 game-clock.ts 偵測到時間跳躍跨過了窗口——不用再比對
  // 現在的 hour 是否還落在窗口內（跳躍後很可能已經不在了），直接觸發。
  if (dayTwoMorningEvent.due) return true;
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  return gameState.currentDay === 1 && hour >= 8 && hour < 8.5;
}

export function startDayTwoMorningEvent() {
  dayTwoMorningEvent.triggered = true;
  dayTwoMorningEvent.due = false;
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
