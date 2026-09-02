import { gameState, inventory, TIME_CONFIG, dayLength } from "./game-state";
import {
  DAY_TWO_MORNING_ARRIVAL,
  DAY_TWO_PORT_ARRIVAL,
  carpenterQuest,
  portGroundY,
  LAYOUT,
} from "./layout-maps";
import { npcGroup, npcs } from "./npc-runtime";
import { loadMap } from "./build-map";
import { runBlackTransition } from "./loading-screen";
import { groundY } from "./scene-sky";
import { dialogQueue, showDialogSequence, systemDialog } from "./dialogue";
import type { ComicCueKind } from "./comic-cue";
import {
  startGuidedWalk,
  endExternalGuidedWalk,
  animatePrologueZoom,
} from "./prologue";
import { setTimePauseSource } from "./time-pause";
import { addAffectionReward } from "./affection";

// ==============================================================
// 第二天早上劇本——Zeppelin 2026-09-02 給的完整版：村長來敲門 → 一起去
// 港口接歐文(木匠)＋露比(藝術家) → （下一輪）去舊城鎮選屋、上山學採集、
// 回來修繕。見 docs/decisions/day-two-morning-event.md。
//
// 這一版正式取代兩件事：
// 1. 舊的「試試看」佔位演出（只有黑幕轉場+站位，沒有台詞）。
// 2. carpenter-quest.ts 的碼頭觸碰事件（startCarpenterDockScene 等）——
//    兩套本來都卡在 day===1 && hour∈[8,8.5)，現在合併我村長強制帶隊去
//    港口這一場，碼頭觸碰點還留著但 carpenterQuest.stage 一路推進到
//    "moved_in" 後就永遠是 no-op，不用另外刪 events 表。
//
// 2026-09-02 第二輪：Zeppelin 反饋「避免弶制事件被跳過」——睡覺(或 N
// 鍵快轉)一次跳好幾小時是單一幀內瞬間賦值(見 game-clock.ts
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

export const dayTwoMorningEvent = {
  triggered: false,
  // holding=true 期間，game-loop.ts 的 NPC 排程迴圈會整段跳過日常
  // 行程表/escort 機制，改用 holdPositions 裡的固定座標——見該檔案
  // 「dayTwoMorningEvent.holding」那段。holdMap 限制「只在這張地圖上
  // 生效」，避免玩家用存讀檔等手段換了地圖後，held 的 NPC 詭異地卡在
  // 舊地圖座標不放。
  holding: false,
  holdMap: null as string | null,
  holdPositions: null as Record<
    string,
    { x: number; z: number; rotY: number }
  > | null,
  due: false,
  phase: "idle" as
    | "idle"
    | "port"
    | "villageWalk"
    | "mountainRoute"
    | "gathering"
    | "returning"
    | "complete",
  woodStart: 0,
  stoneStart: 0,
  rewardGranted: false,
  materialsSpent: false,
};

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

// ------ 對話行 helper：跟 prologue-script.ts 同一套 speaker/name 慣例，
// 這裡不走 i18n（day2-morning-event.ts 是獨立劇本檔，不是序章章節），
// 直接放繁中字串，跟 carpenter-quest.ts 的寫法一致。------
const mayor = (text: string) => ({ text, speaker: "mayor", name: "村長" });
const carpenter = (
  text: string,
  revealNameAfter?: { npcId: string; stage: 1 },
) => ({
  text,
  speaker: "carpenter",
  name: "歐文",
  revealNameAfter,
});
const artist = (
  text: string,
  revealNameAfter?: { npcId: string; stage: 1 | 2 },
) => ({
  text,
  speaker: "artist",
  name: "露比",
  revealNameAfter,
});
const captain = (text: string) => ({ text, speaker: "captain", name: "船長" });
const cue = (text: string, actorId: string, kind: ComicCueKind) => ({
  text,
  comicCue: { actorId, kind },
});

function holdNpcsAt(
  map: string,
  positions: Record<string, { x: number; z: number; rotY: number }>,
) {
  dayTwoMorningEvent.holding = true;
  dayTwoMorningEvent.holdMap = map;
  dayTwoMorningEvent.holdPositions = positions;
}
function releaseHold() {
  dayTwoMorningEvent.holding = false;
  dayTwoMorningEvent.holdMap = null;
  dayTwoMorningEvent.holdPositions = null;
}

export function startDayTwoMorningEvent() {
  dayTwoMorningEvent.triggered = true;
  dayTwoMorningEvent.due = false;
  dayTwoMorningEvent.phase = "port";
  // 家門口與港口都是不可操作的事件演出：沿用 game-loop.ts 的
  // cutscene-presentation，隱藏地圖／資訊／選單與快捷操作 UI。
  // beginMountainRoute() 交還自由行走時會再解除。
  gameState.cutsceneActive = true;
  setTimePauseSource("guidedGameplay", true);
  loadMap("livingArea", DAY_TWO_MORNING_ARRIVAL.player, () => {
    // 模型鼻子朝本地 -Z，rotation.y = atan2(dx,dz)+π 是全專案統一公式
    // （見 game-loop.ts NPC 走位那段同一條註解）。面朝下(+Z，dx=0,dz=1)
    // 就是 atan2(0,1)+π = π。
    gameState.player.rotation.y = Math.PI;
    const mayorNpc = npcs.find((n) => n.id === "mayor");
    if (mayorNpc) {
      npcGroup.visible = true;
      mayorNpc.mesh.visible = true;
      mayorNpc.mesh.position.set(
        DAY_TWO_MORNING_ARRIVAL.mayor.x,
        groundY(
          DAY_TWO_MORNING_ARRIVAL.mayor.x,
          DAY_TWO_MORNING_ARRIVAL.mayor.z,
        ),
        DAY_TWO_MORNING_ARRIVAL.mayor.z,
      );
      // 面朝上(-Z，dx=0,dz=-1)：atan2(0,-1)+π = 0，跟玩家隔一格面對面。
      mayorNpc.mesh.rotation.y = 0;
      mayorNpc.path = null;
      mayorNpc.lastTargetKey = null;
    }
    holdNpcsAt("livingArea", {
      mayor: {
        x: DAY_TWO_MORNING_ARRIVAL.mayor.x,
        z: DAY_TWO_MORNING_ARRIVAL.mayor.z,
        rotY: 0,
      },
    });
    showDialogSequence(
      [
        mayor("「早安。」"),
        mayor("「今天有兩位新居民要搬來島上。」"),
        mayor("「一位是木匠，另一位是藝術家。」"),
        mayor("「船差不多要到了，我們一起去港口接他們吧。」"),
        "[村長進入同行狀態]",
      ],
      startPortArrivalScene,
    );
  });
}

// 村長「進入同行狀態」在這場戲裡不是要玩家重走一次已經走過的路——
// Zeppelin 原話：「接著可以直接黑屏，不必再讓玩家重走一次已經走過的
// 路」。所以這裡不啟用 escort 機制，直接黑屏傳送到港口，抵達後才是
// 玩家真正看得到、有意義的一場戲。
function loadEventMap(
  mapName: string,
  startPos: { x: number; z: number },
  onLoaded: () => void,
) {
  void runBlackTransition(
    "long",
    () =>
      new Promise<void>((resolve) => {
        loadMap(mapName, startPos, () => {
          onLoaded();
          resolve();
        });
      }),
  );
}
function startPortArrivalScene() {
  loadEventMap("port", DAY_TWO_PORT_ARRIVAL.player, () => {
    gameState.player.rotation.y = 0; // 面朝上(-Z)看著剛靠岸的船
    const mayorNpc = npcs.find((n) => n.id === "mayor");
    const carpenterNpc = npcs.find((n) => n.id === "carpenter");
    const artistNpc = npcs.find((n) => n.id === "artist");
    const y = gameState.player.position.y;
    // 村長跟主角一起走過來，疊在主角腳下（跟 carpenter-quest.ts 舊版
    // startCarpenterDockScene() 同一招：起點座標不重要，下一幀就會被
    // holdPositions 覆寫到正確站位，這裡只是避免第一幀出現在原地）。
    if (mayorNpc) {
      npcGroup.visible = true;
      mayorNpc.mesh.visible = true;
      mayorNpc.mesh.position.set(
        DAY_TWO_PORT_ARRIVAL.player.x,
        y,
        DAY_TWO_PORT_ARRIVAL.player.z,
      );
      mayorNpc.path = null;
      mayorNpc.lastTargetKey = null;
    }
    // 歐文／露比這時候才第一次在 livingArea 以外「登場」——直接開
    // visible，不用等 carpenterQuest.stage 或任何既有旗標（那些是舊
    // 流程用的，這輪已經合併掉，見檔案開頭說明）。
    if (carpenterNpc) {
      carpenterNpc.mesh.visible = true;
      carpenterNpc.mesh.position.set(
        DAY_TWO_PORT_ARRIVAL.carpenter.x,
        portGroundY(
          DAY_TWO_PORT_ARRIVAL.carpenter.x,
          DAY_TWO_PORT_ARRIVAL.carpenter.z,
        ),
        DAY_TWO_PORT_ARRIVAL.carpenter.z,
      );
      carpenterNpc.path = null;
      carpenterNpc.lastTargetKey = null;
    }
    if (artistNpc) {
      artistNpc.mesh.visible = true;
      artistNpc.mesh.position.set(
        DAY_TWO_PORT_ARRIVAL.artist.x,
        portGroundY(
          DAY_TWO_PORT_ARRIVAL.artist.x,
          DAY_TWO_PORT_ARRIVAL.artist.z,
        ),
        DAY_TWO_PORT_ARRIVAL.artist.z,
      );
      artistNpc.path = null;
      artistNpc.lastTargetKey = null;
    }
    holdNpcsAt("port", {
      mayor: {
        x: DAY_TWO_PORT_ARRIVAL.player.x,
        z: DAY_TWO_PORT_ARRIVAL.player.z,
        rotY: 0,
      },
      carpenter: {
        x: DAY_TWO_PORT_ARRIVAL.carpenter.x,
        z: DAY_TWO_PORT_ARRIVAL.carpenter.z,
        rotY: Math.PI,
      },
      artist: {
        x: DAY_TWO_PORT_ARRIVAL.artist.x,
        z: DAY_TWO_PORT_ARRIVAL.artist.z,
        rotY: Math.PI,
      },
      // 船長留在自己碼頭邊的日常站位就好，不用特別釘住——這裡先不放
      // captain 進 holdPositions，讓他照原本的行程表小範圍走動。
    });
    showDialogSequence(
      [
        "[船靠岸]",
        "[歐文背著工具包走下船]",
        "[船長正在把歐文的行李搬下來]",
        "[另一名背著畫具的陌生女子跟著下船]",
        mayor("「歡迎來到島上。」"),
        mayor("「你們就是今天抵達的歐文和……」"),
        "[歐文忽然停下][低頭][蹲下來敲了敲腳邊的木板]",
        mayor("「……歐文？」"),
        carpenter("「別踩這裡。」"),
        cue("[主角頭上「！」]", "player", "!"),
        carpenter("「這塊木板裡面已經腐掉了。」"),
        carpenter("「再拖一個月，誰踩上去誰就下海。」"),
        mayor("「咦？有這麼嚴重嗎？」"),
        mayor("「我前幾天經過時還好好的……」"),
        carpenter("「表面看不出來才危險。」"),
        "[歐文沿著木板看了一圈]",
        carpenter("「旁邊這兩塊也要換。」"),
        carpenter("「底下的支撐最好一起檢查。」"),
        captain("「你才剛下船吧。」"),
        carpenter("「嗯。」"),
        captain("「行李都還在我手上。」"),
        "[歐文抬頭][這才像突然想起自己是來報到的]",
        carpenter("「……抱歉。」"),
        carpenter("「我是歐文。」", { npcId: "carpenter", stage: 1 }),
        carpenter("「今天剛到的木匠。」"),
        "[歐文正式登場]",
        carpenter("「聽說島上有不少房子需要修。」"),
        carpenter("「現在看來，可能不只房子。」"),
        artist("「……他一直都是這樣嗎？」"),
        mayor("「我也是第一次見他……」"),
        captain("「至少不用擔心他找不到工作。」"),
        mayor("「差點忘了。」"),
        mayor("「那妳就是另一位申請來島上的藝術家吧？」"),
        artist("「嗯。」"),
        artist("「我是露比，請多指教。」", { npcId: "artist", stage: 1 }),
        "[藝術家正式登場]",
        artist("「不過我覺得這裡挺漂亮的。」"),
        carpenter("「這裡？」"),
        artist("「木頭被海風吹成這種顏色，很好看。」"),
        carpenter("「……那是劣化。」"),
        artist("「我知道。」"),
        carpenter("「要換掉。」"),
        artist("「我也知道。」"),
        mayor("「……總之，我們先去看看你們住的地方吧。」"),
      ],
      onPortArrivalSceneComplete,
    );
  });
}

// 港口戲結束——接下來(下一輪)是去舊城鎮選屋，改用 carpenterQuest.stage
// 既有的 "escorting" 狀態機交給既有的 escort trail 機制（見
// game-loop.ts isCarpenterEscortActor／build-map.ts loadMap 換圖時的
// 自動重新定位那段）接手「跟隨模式」，不用另外寫一套跟隨邏輯。這裡先
// 釋放 holdPositions（歐文/村長改交給 escort 機制、露比回她自己原本的
// 日常排程——她的登場戲到此結束，後續劇情這輪還沒寫）。
function onPortArrivalSceneComplete() {
  carpenterQuest.stage = "escorting";
  startVillageHouseTour();
}

const VILLAGE_TOUR = {
  start: { x: 152, z: 17 },
  firstHouse: { x: 143, z: 17 },
  carpenterHouse: { x: 137, z: 17 },
} as const;

function startVillageHouseTour() {
  dayTwoMorningEvent.phase = "villageWalk";
  gameState.cutsceneActive = true;
  loadEventMap("oldVillage", { x: 152, z: 18 }, () => {
    // 露比的登場戲在港口結束；選屋只由村長帶主角與歐文前往。
    const artistNpc = npcs.find((npc) => npc.id === "artist");
    if (artistNpc) artistNpc.mesh.visible = false;
    holdNpcsAt("oldVillage", {
      mayor: { ...VILLAGE_TOUR.start, rotY: Math.PI / 2 },
      carpenter: { x: 153.2, z: 17.45, rotY: Math.PI / 2 },
    });
    startGuidedWalk(
      [VILLAGE_TOUR.start, VILLAGE_TOUR.firstHouse],
      () => {
        endExternalGuidedWalk();
        showDialogSequence(
          [carpenter("「……」"), carpenter("「看下一間好了。」")],
          () =>
            startGuidedWalk(
              [VILLAGE_TOUR.firstHouse, VILLAGE_TOUR.carpenterHouse],
              finishVillageHouseTour,
              { zoom: 5, external: true },
            ),
        );
      },
      { zoom: 5, external: true },
    );
  });
}

function finishVillageHouseTour() {
  endExternalGuidedWalk();
  showDialogSequence(
    [
      carpenter("「……屋頂要補，外牆有受潮，不過樑柱還能用。」"),
      carpenter("「不用拆。」"),
      carpenter("「好，就這棟了。」"),
      carpenter("「我需要一些材料。」"),
      mayor("「山上應該還能找到木材和石材。」"),
      carpenter("「好，那我去取。」"),
      cue("[主角看著他]", "player", "..."),
      carpenter("「……」"),
      carpenter("「你是不是也想知道山上的材料怎麼採？」"),
      cue("[主角點頭]", "player", "!"),
      carpenter("「正好。」"),
      carpenter("「你以後要擴建牧場，也少不了木材和石材。」"),
      carpenter("「我有一把備用的萬用斧，給你吧。」"),
      carpenter("「以後你就能自己取得木材跟石材了。」"),
      systemDialog("獲得萬用斧"),
      carpenter("「那麼，我們出發吧。」"),
      mayor("「山從村莊西北的樓梯走就能到了。」"),
    ],
    () => animatePrologueZoom(10, 0.9, beginMountainRoute),
  );
}

function beginMountainRoute() {
  // 探房演出結束後解除固定站位，讓既有 carpenter escort trail 接手
  // 村長與歐文跟隨主角前往山區。
  releaseHold();
  inventory.tools.dualAxe = true;
  gameState.harvestFeedback = {
    kind: "success",
    title: "獲得道具",
    text: "萬用斧",
    count: 1,
    until: gameState.elapsed + 2.6,
  };
  dayTwoMorningEvent.phase = "mountainRoute";
  gameState.cutsceneActive = false;
  setTimePauseSource("guidedGameplay", true);
}

function startMountainGatheringTutorial() {
  if (dayTwoMorningEvent.phase !== "mountainRoute") return;
  dayTwoMorningEvent.phase = "gathering";
  gameState.cutsceneActive = true;
  const arrival = LAYOUT.mountain.townArrival;
  holdNpcsAt("mountain", {
    mayor: { x: arrival.x - 1, z: arrival.z + 1, rotY: 0 },
    carpenter: { x: arrival.x + 1, z: arrival.z + 1, rotY: 0 },
  });
  showDialogSequence(
    [
      carpenter("「好，那麼，我教你一下用法吧。」"),
      carpenter("「走到落枝、石頭旁，然後按下 E 即可獲得材料。」"),
      carpenter("「先試著收集十份木材和十份石材。」"),
    ],
    () => {
      dayTwoMorningEvent.woodStart = inventory.wood;
      dayTwoMorningEvent.stoneStart = inventory.stone;
      gameState.cutsceneActive = false;
      releaseHold();
      renderGatherObjective();
    },
  );
}

function gatheredWood() {
  return Math.max(0, inventory.wood - dayTwoMorningEvent.woodStart);
}
function gatheredStone() {
  return Math.max(0, inventory.stone - dayTwoMorningEvent.stoneStart);
}

function renderGatherObjective() {
  const el = document.getElementById("dayTwoObjective");
  if (!el) return;
  if (dayTwoMorningEvent.phase !== "gathering") {
    el.style.display = "none";
    return;
  }
  el.textContent = `任務：木材 ${Math.min(10, gatheredWood())}/10｜石材 ${Math.min(10, gatheredStone())}/10`;
  el.style.display = "block";
}

function finishGatheringTutorial() {
  if (dayTwoMorningEvent.phase !== "gathering") return;
  dayTwoMorningEvent.phase = "returning";
  gameState.cutsceneActive = true;
  renderGatherObjective();
  showDialogSequence(
    [
      carpenter("「嗯，夠了。」"),
      carpenter("「第一次用就挺順手的。」"),
      carpenter("「走吧，回去把房子處理掉。」"),
    ],
    startCarpenterRepairScene,
  );
}

const repairCg = (text: string) => ({
  ...carpenter(text),
  cg: "day2Carpenter-01",
});

function startCarpenterRepairScene() {
  if (!dayTwoMorningEvent.materialsSpent) {
    inventory.wood = Math.max(0, inventory.wood - 10);
    inventory.stone = Math.max(0, inventory.stone - 10);
    dayTwoMorningEvent.materialsSpent = true;
  }
  loadEventMap("oldVillage", { x: 137, z: 18 }, () => {
    holdNpcsAt("oldVillage", {
      carpenter: { ...VILLAGE_TOUR.carpenterHouse, rotY: Math.PI },
    });
    showDialogSequence([carpenter("「好，那我要開始修繕了。」")], () => {
      void runBlackTransition("short", () => {
        showDialogSequence(
          [
            repairCg("「海邊的房子最麻煩的不是雨，是濕氣和鹽。」"),
            repairCg("「外觀看起來沒什麼，裡面可能早就開始腐了。」"),
            "[歐文敲了敲拆下來的木料]",
            repairCg("「像這塊。」"),
            repairCg("「再晚一點處理，就不是換幾塊木頭能解決的了。」"),
            {
              text: "……",
              speaker: "hero",
              name: "主角",
              cg: "day2Carpenter-01",
            },
            repairCg("「怎麼？」"),
            "[主角搖頭]",
            repairCg("「放心。」"),
            repairCg("「這棟還救得回來。」"),
            repairCg("「不然我也不會選它。」"),
            "[繼續施工]",
            repairCg("「材料夠我先處理最危險的地方了。」"),
            repairCg("「剩下的我自己慢慢來。」"),
            repairCg("「你今天已經幫很多了。」"),
            repairCg("「謝了。」"),
            "[看了一眼還沒整理好的屋內]",
            repairCg("「等這裡整理好，再請你進來坐吧。」"),
            "[歐文好感 +30]",
            "[個人事件完成]",
          ],
          completeDayTwoMorningEvent,
        );
      });
    });
  });
}

function completeDayTwoMorningEvent() {
  if (!dayTwoMorningEvent.rewardGranted) {
    addAffectionReward("carpenter", "personalEvent");
    dayTwoMorningEvent.rewardGranted = true;
  }
  carpenterQuest.stage = "moved_in";
  dayTwoMorningEvent.phase = "complete";
  releaseHold();
  setTimePauseSource("guidedGameplay", false);
  gameState.cutsceneActive = false;
}

export function canTriggerDayTwoTouchEvent(map: string, x: number, z: number) {
  if (dayTwoMorningEvent.phase === "mountainRoute") {
    const gate = LAYOUT.oldVillage.mountainGate;
    return (
      map === "oldVillage" &&
      z === gate.z &&
      x >= gate.x - 1 &&
      x <= gate.x + gate.width - 2
    );
  }
  return dayTwoMorningEvent.phase !== "gathering";
}

export function updateDayTwoWalkFollowers() {
  setTimePauseSource(
    "guidedGameplay",
    dayTwoMorningEvent.phase !== "idle" &&
      dayTwoMorningEvent.phase !== "complete",
  );
  if (
    dayTwoMorningEvent.phase === "villageWalk" &&
    dayTwoMorningEvent.holdPositions
  ) {
    const mayorNpc = npcs.find((npc) => npc.id === "mayor");
    if (mayorNpc) {
      dayTwoMorningEvent.holdPositions.mayor = {
        x: mayorNpc.mesh.position.x,
        z: mayorNpc.mesh.position.z,
        rotY: mayorNpc.mesh.rotation.y,
      };
      dayTwoMorningEvent.holdPositions.carpenter = {
        x: mayorNpc.mesh.position.x + 1.15,
        z: mayorNpc.mesh.position.z + 0.45,
        rotY: mayorNpc.mesh.rotation.y,
      };
    }
  }
  if (
    dayTwoMorningEvent.phase === "mountainRoute" &&
    gameState.currentMapName === "mountain"
  ) {
    startMountainGatheringTutorial();
  }
  if (dayTwoMorningEvent.phase === "gathering") {
    renderGatherObjective();
    if (gatheredWood() >= 10 && gatheredStone() >= 10) {
      finishGatheringTutorial();
    }
  }
}

export function resetDayTwoMorningEvent() {
  Object.assign(dayTwoMorningEvent, {
    triggered: false,
    holding: false,
    holdMap: null,
    holdPositions: null,
    due: false,
    phase: "idle",
    woodStart: 0,
    stoneStart: 0,
    rewardGranted: false,
    materialsSpent: false,
  });
  setTimePauseSource("guidedGameplay", false);
  renderGatherObjective();
}
