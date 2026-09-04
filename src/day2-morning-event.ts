import { gameState, inventory, TIME_CONFIG, dayLength } from "./game-state";
import {
  DAY_TWO_MORNING_ARRIVAL,
  DAY_TWO_PORT_ARRIVAL,
  carpenterQuest,
  artistQuest,
  ARTIST_EVENT_WAIT_POS,
  portGroundY,
  oldVillageGroundY,
  mountainGroundY,
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
  syncLastPlayerY,
} from "./prologue";
import { setTimePauseSource } from "./time-pause";
import { addAffectionReward } from "./affection";
import { announceHomeVisitorThenRun } from "./ui-toast";
import { FLOWER_SPECIES, type FlowerSpeciesId } from "./wildflowers";
import { animateWalk, FACING_ANGLE } from "./humanoid";

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
  // 2026-09-04：露比離隊後自己走去定點那段(walkArtistToWaitSpot())用
  // 的旗標——單純只是讓 game-loop.ts 逐幀排程迴圈那段暫時跳過她，不要
  // 被日常排程的 A* 系統搶著改 position，跟 holding/holdPositions 是
  // 兩回事，不會互相干擾。true 的時候 walkArtistToWaitSpot() 自己的
  // rAF 迴圈直接控制她的 mesh，包含呼叫 animateWalk()。
  artistSoloWalking: false,
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
const hero = (text: string) => ({ text, speaker: "hero", name: "主角" });
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
  // 2026-09-04：原本時間一到就不管玩家在哪直接黑屏傳送，Zeppelin 反饋
  // 想先跳一段「有人來家裡了」的提示、停頓一下再進正式劇情——上面
  // triggered 已經同步設成 true，接下來每一幀 canStartDayTwoMorningEvent()
  // 都會直接短路，所以延遲執行的這段不會被重複觸發。
  announceHomeVisitorThenRun(() => {
    // 家門口與港口都是不可操作的事件演出：沿用 game-loop.ts 的
    // cutscene-presentation，隱藏地圖／資訊／選單與快捷操作 UI。
    // beginMountainRoute() 交還自由行走時會再解除。
    gameState.cutsceneActive = true;
    setTimePauseSource("guidedGameplay", true);
    loadMap("livingArea", DAY_TWO_MORNING_ARRIVAL.player, () => {
      // loadMap() 剛把 position.y 設成這張圖正確的地形高度；這裡的
      // cutsceneActive 已經是 true，之後每幀 reapplyProloguePlayerY()
      // 會把 Y 蓋成 lastPlayerY，所以要先同步一次，見 prologue.ts
      // syncLastPlayerY() 上面 2026-09-04 補的說明。
      syncLastPlayerY();
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
          // 同上：loadMap() 剛算好這張新地圖的地形高度，先同步一次給
          // reapplyProloguePlayerY() 用，見 prologue.ts syncLastPlayerY()
          // 的說明；onLoaded() 之後如果又動了玩家座標，下面再補一次。
          syncLastPlayerY();
          onLoaded();
          syncLastPlayerY();
          resolve();
        });
      }),
  );
}
function startPortArrivalScene() {
  loadEventMap("port", DAY_TWO_PORT_ARRIVAL.player, () => {
    // 2026-09-04 改版佔位：主角/村長站西側那排面向東(right)，歐文/
    // 露比站東側那排面向西(left)，兩排面對面，見 layout-maps.ts
    // DAY_TWO_PORT_ARRIVAL 旁的說明。
    gameState.player.rotation.y = FACING_ANGLE.right;
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
      // 2026-09-03 修正：站位改用村長自己的座標，不再疊在主角腳下把
      // 主角整場戲遮住（見 layout-maps.ts DAY_TWO_PORT_ARRIVAL.mayor
      // 旁的說明）。
      mayorNpc.mesh.position.set(
        DAY_TWO_PORT_ARRIVAL.mayor.x,
        y,
        DAY_TWO_PORT_ARRIVAL.mayor.z,
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
        x: DAY_TWO_PORT_ARRIVAL.mayor.x,
        z: DAY_TWO_PORT_ARRIVAL.mayor.z,
        rotY: FACING_ANGLE.right,
      },
      carpenter: {
        x: DAY_TWO_PORT_ARRIVAL.carpenter.x,
        z: DAY_TWO_PORT_ARRIVAL.carpenter.z,
        rotY: FACING_ANGLE.left,
      },
      artist: {
        x: DAY_TWO_PORT_ARRIVAL.artist.x,
        z: DAY_TWO_PORT_ARRIVAL.artist.z,
        rotY: FACING_ANGLE.left,
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
    // 2026-09-03 Zeppelin 反饋：選屋這段也讓露比跟著走（原本只有村長/
    // 歐文陪同，露比港口登場戲結束就被藏起來）。跟歐文一樣進
    // holdPositions，updateDayTwoWalkFollowers() 每幀一起重算跟著村長
    // 走——這裡只是開場定格的起始站位，要跟那邊的公式方向一致。
    // 2026-09-04：這組初始站位原本讓露比落在 x=150.8，比村長起點
    // (152)更靠 -x（隊伍前進方向），等於一開始就排在隊伍最前面，跟
    // Zeppelin 反饋的「應該在隊伍最後面」相反——改成跟
    // updateDayTwoWalkFollowers() 裡的公式同一個方向(+2.3x/+0.15z)，
    // 開場第一幀就跟後續每幀算出來的位置一致，不會有一幀的跳動。
    const artistNpc = npcs.find((npc) => npc.id === "artist");
    if (artistNpc) artistNpc.mesh.visible = true;
    holdNpcsAt("oldVillage", {
      mayor: { ...VILLAGE_TOUR.start, rotY: Math.PI / 2 },
      carpenter: { x: 153.2, z: 17.45, rotY: Math.PI / 2 },
      artist: { x: 154.3, z: 17.15, rotY: Math.PI / 2 },
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
      // 2026-09-03 Zeppelin：上山採集前加一段，讓露比明確表態不跟去。
      // 2026-09-04 Zeppelin 反饋「露比沒有走到他的房子而是跑到廣場
      // 了」——這段原本的想法是說完這兩句、holdPositions 被
      // beginMountainRoute() 釋放後，她會自動退回 npc-defs.ts 原本的
      // 舊城鎮日常排程，覺得不需要另外寫程式碼攔她。但日常排程跟她
      // 剛講的「隔壁那棟房子」完全無關，玩家看到的就是她憑空走去別
      // 的地方——實際上要有效果，得讓 beginMountainRoute() 把她放進
      // ARTIST_EVENT_WAIT_POS 那個「站定點」狀態（跟 completeDayTwo
      // MorningEvent() 最後接的是同一個 stage），而不是真的放生給日常
      // 排程，見下面 beginMountainRoute() 的說明。
      artist("「我先不跟你們上山了，這附近我想再逛逛。」"),
      artist("「隔壁那棟房子我蠻喜歡的，先去放行李了。」"),
      mayor("「也好，路上小心。」"),
    ],
    () => animatePrologueZoom(10, 0.9, beginMountainRoute),
  );
}

// 2026-09-04 Zeppelin 反饋「木匠事件後露比直接不見了，讓她離隊後自己
// 走到定點可以嗎」——上一輪的做法是 releaseHold() 之後直接把
// artistQuest.stage 設成 waiting_oldVillage，game-loop.ts 的釘位邏輯
// 下一幀就會把她「瞬移」到 ARTIST_EVENT_WAIT_POS，跟隊伍走位的位置一
// 對不上，看起來就是憑空消失。改成用一個小工具讓她從離隊當下的座標
// 自己走過去，走到了才真的推進 stage、交給釘位邏輯接手。
//
// 2026-09-04 二次修正：第一版借用 holdNpcsAt()/dayTwoMorningEvent.
// holding，靠 game-loop.ts 的「holding」分支自己比較前後兩幀座標差
// 決定要不要播走路動畫——Zeppelin 反饋「順移了，沒有進入行走動畫」。
// 追下來是這個寫法本身的設計問題：holdNpcsAt() 是每幀從這裡(walk
// ArtistToWaitSpot 自己的 rAF 迴圈)重新呼叫，跟 game-loop.ts 主迴圈是
// 兩個各自獨立、沒有互相同步的 requestAnimationFrame 鏈，「這幀的
// holdPositions 有沒有真的更新到」跟「game-loop.ts 這幀有沒有讀到最
// 新值」時序上對不齊，比較前後兩幀座標差來推斷有沒有在動這件事就不可
// 靠。改成完全比照 walkPlayerTo() 的寫法——不再假手 holding 分支去
// 「猜」有沒有在動，直接在這個函式自己的 rAF 迴圈裡呼叫
// animateWalk(mesh, true, ...)，全部自己算好、自己套用，不依賴任何
// 跨迴圈的狀態推斷。要避免 game-loop.ts 的日常排程 A* 系統這段時間
// 搶著改她的 position，改成一個新的簡單旗標
// dayTwoMorningEvent.artistSoloWalking（見上面宣告旁的說明），比繼續
// 沿用語意不完全對得上的 holding 更明確、不會有上述的時序問題。
// 2026-09-04 抽成通用版：原本只服務 ARTIST_EVENT_WAIT_POS(舊城鎮定
// 點)，露比上山採花這段改成用走的之後(見下面 beginFlowerMountainWalk/
// settleArtistAtFlowerSpot)，山上那段「入口走到花叢定點」的短距離收尾
// 也要用同一套「自己算好、自己套用」的獨立 rAF 動畫，差別只在目的地
// 座標跟地形高度函式(oldVillageGroundY vs mountainGroundY)，直接參數化
// 兩者，避免整段複製貼上兩份。
function walkArtistTo(
  target: { x: number; z: number },
  groundY: (x: number, z: number) => number,
  onDone: () => void,
) {
  const artistNpc = npcs.find((n) => n.id === "artist");
  if (!artistNpc) {
    onDone();
    return;
  }
  const mesh = artistNpc.mesh;
  const start = { x: mesh.position.x, z: mesh.position.z };
  const dx = target.x - start.x;
  const dz = target.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) {
    onDone();
    return;
  }
  mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
  dayTwoMorningEvent.artistSoloWalking = true;
  const speed = 1.6; // 跟 game-loop.ts 日常排程 NPC 同一個走路速度
  const durationMs = (dist / speed) * 1000;
  const startTime = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - startTime) / durationMs);
    mesh.position.x = start.x + dx * t;
    mesh.position.z = start.z + dz * t;
    // 跟 walkPlayerTo()、game-loop.ts 逐幀釘位那幾段同一個順序：
    // animateWalk() 會直接覆蓋 position.y 成踏步彈跳量，一定要先呼叫、
    // 再用 += 疊加地形高度。
    animateWalk(mesh, t < 1, gameState.elapsed);
    mesh.position.y += groundY(mesh.position.x, mesh.position.z) + 0.03;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      dayTwoMorningEvent.artistSoloWalking = false;
      onDone();
    }
  }
  requestAnimationFrame(step);
}
function walkArtistToWaitSpot(onDone: () => void) {
  walkArtistTo(ARTIST_EVENT_WAIT_POS, oldVillageGroundY, onDone);
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
  // phase 要在 walkArtistToWaitSpot() 的第一幀跑之前就切掉，不然
  // updateDayTwoWalkFollowers() 還認得 "villageWalk"，每幀會用村長的
  // 位置重算 holdPositions.artist，跟這裡剛開始的走路動畫互相搶著寫
  // 同一個欄位。
  dayTwoMorningEvent.phase = "mountainRoute";
  gameState.cutsceneActive = false;
  setTimePauseSource("guidedGameplay", true);
  // 2026-09-04：露比剛講完「先去放行李」，不能真的放給 npc-defs.ts 的
  // 日常排程（那組排程跟這句台詞完全無關，會讓她憑空走到不相干的地
  // 方，比如廣場），也不能直接瞬移到 ARTIST_EVENT_WAIT_POS（看起來像
  // 憑空消失）——改成讓她自己走過去，走到了才推進 stage，交給
  // game-loop.ts 的釘位邏輯接手，一路撐到 completeDayTwoMorningEvent()
  // 接上她的個人事件為止，跟台詞對得上。
  if (artistQuest.stage === "not_started") {
    walkArtistToWaitSpot(() => {
      artistQuest.stage = "waiting_oldVillage";
    });
  }
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
  // 2026-09-02 反饋：任務提示框跟立繪同一塊區域，採集教學那三句對話
  // 期間 phase 其實已經先切成 "gathering"(見 updateDayTwoWalkFollowers()
  // 每幀輪詢那段)，導致提示框在對話還沒關掉、立繪還在畫面上時就先跳
  // 出來蓋住臉，看起來像馬賽克。改成也一併檢查對話框/演出狀態，跟
  // Zeppelin 要的「自由活動開始再顯示」對齊——這裡本來就是每幀輪詢
  // 呼叫(phase==="gathering" 時)，不用另外加呼叫點，對話一關掉、
  // cutsceneActive 一放開，下一幀自然就會顯示出來。
  if (
    dayTwoMorningEvent.phase !== "gathering" ||
    dialogQueue.length > 0 ||
    gameState.cutsceneActive
  ) {
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
// 2026-09-02：[繼續施工]之後歐文已經上屋頂動工，換一張差分(屋頂+
// 鐵鎚，跟 day2Carpenter-01 室內檢查木料是同一套服裝/場景延續)。
// setDialogCg() 同一時間點只要 cg id 不同就直接切換底圖，overlay 本身
// 的 opacity 沒有被重置成 0 再淡入，所以這裡換圖不會黑屏——不用額外包
// runBlackTransition，直接改 cg id 就是 Zeppelin 要的效果。
const repairCg2 = (text: string) => ({
  ...carpenter(text),
  cg: "day2Carpenter-02",
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
            repairCg2("「材料夠我先處理最危險的地方了。」"),
            repairCg2("「剩下的我自己慢慢來。」"),
            repairCg2("「你今天已經幫很多了。」"),
            repairCg2("「謝了。」"),
            "[看了一眼還沒整理好的屋內]",
            repairCg2("「等這裡整理好，再請你進來坐吧。」"),
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
  // 2026-09-03 Zeppelin：「木匠事件結束後準備接露比事件」——原本是讓
  // 她站在舊城鎮定點（ARTIST_EVENT_WAIT_POS）等玩家自己走過去碰觸發，
  // game-loop.ts 逐幀把她釘在那個座標，蓋掉原本的日常排程。
  // 2026-09-04 Zeppelin 三輪回報「事件結束後根本沒看到露比」——逐行核對
  // 過 makeArtist() 的模型、ARTIST_EVENT_WAIT_POS 座標（跟舊城鎮西擴
  // +100 平移換算後落在木匠家隔壁棟，不是外海／地圖邊界外）、
  // game-loop.ts 的逐幀釘位邏輯、buildMap() 換圖時的顯示/隱藏判斷，
  // 都沒找到邏輯錯誤；玩家自己回報「走過去確實有觸發」，代表 stage
  // 機器跟觸碰事件本身其實是通的，問題比較像是「不知道要往哪走、
  // 相機也沒帶到那裡」的可發現性落差，不是渲染真的壞掉。
  // Zeppelin 從第一輪就講「理論要直接接」，這輪又明確要「自動觸發＋
  // 自動走過去」——與其繼續猜可發現性問題，改成木匠戲一結束就直接
  // 接上露比開場白，不再經過「站著等玩家自己找到」這個中間站。
  // 之後如果想恢復成「玩家自由探索」的體驗，把下面兩行換回
  // `artistQuest.stage = "waiting_oldVillage";` 就好，ARTIST_EVENT_WAIT_POS
  // 那個站位跟觸碰事件本身沒有動，都還在。
  // beginMountainRoute() 現在已經把她推進到 waiting_oldVillage（見上面
  // 2026-09-04 那則說明），這裡改成接受 not_started／waiting_oldVillage
  // 兩種狀態都觸發——保留 not_started 分支是防呆：萬一之後劇本調整、
  // 有其他路徑跳過 beginMountainRoute() 直接到這裡，還是能正常接上，
  // 不會卡住。
  // 2026-09-04 Zeppelin：「木匠事件結束後先黑屏」——之前是木匠戲最後一句
  // 對話框收掉、下一幀馬上接上露比的開場白，兩場戲之間沒有任何停頓，
  // 觀感上像同一場戲硬接。改成中間補一段短黑幕(跟 CG 切換同款
  // "short")，黑屏期間才切換 stage／真正啟動露比事件，玩家看到的會是
  // 「木匠戲淡出→短暫全黑→淡入露比戲」，兩段戲有明確的段落感。
  if (
    artistQuest.stage === "not_started" ||
    artistQuest.stage === "waiting_oldVillage"
  ) {
    void runBlackTransition("short", () => {
      // 2026-09-04 Zeppelin：「趁黑屏讓村長直接瞬移到廣場，不然她會擋
      // 在前面」——上一輪把村長放行去日常排程後，原本想讓他自己走過
      // 去，但這段對話幾乎全程開著對話框(isGameplayPaused() 只要
      // #dialog 還開著 dt 就是 0)，他大部分時間根本沒機會真的走，等於
      // 一路卡在木匠戲最後站的位置——正好擋在露比開場戲的鏡頭前面。
      // 既然黑屏本來就會擋住畫面，不用等日常排程慢慢帶他過去，直接在
      // 這裡把他的座標一次設到 home 那個廣場定點(跟 npc-defs.ts 裡
      // mayor 整天的排程本來就是繞著這個點走，語意上就是「回到廣場」)。
      // 只設 x/z、path/lastTargetKey 清空，Y 高度跟走路動畫交給
      // game-loop.ts 那段 npcs.forEach 最後統一套用的
      // animateWalk()+=characterGroundY()(對所有沒有被前面分支攔截、
      // 落到預設排程分支的 NPC 都適用，不用在這裡自己重算一次)。
      const mayorNpc = npcs.find((n) => n.id === "mayor");
      if (mayorNpc) {
        mayorNpc.mesh.position.x = LAYOUT.oldVillage.plaza.x + 9;
        mayorNpc.mesh.position.z = LAYOUT.oldVillage.plaza.z + 11;
        mayorNpc.path = null;
        mayorNpc.lastTargetKey = null;
      }
      artistQuest.stage = "intro";
      startArtistPersonalEvent();
    });
  }
}

export function canTriggerDayTwoTouchEvent(map: string, x: number, z: number) {
  // 露比個人事件的採花自由活動階段，比照木匠/村長採集教學同款鎖法——
  // 玩家這時候人在 mountain 到處走，不要讓其他劇情觸碰點在半路上插隊。
  if (artistQuest.stage === "gatheringFlowers") return false;
  // 2026-09-04：露比上山採花這段改成用走的之後，舊城鎮到山門這一小段
  // 自由移動期間，也要跟下面 mountainRoute 分支同一招——只放行山門
  // 本身的觸碰點(讓 WORLD_MAP_TRANSITIONS 正常把玩家帶進 mountain)，
  // 半路上不小心踩到其他劇情觸碰點的話不該插隊。
  if (artistQuest.stage === "walkingToMountain") {
    const gate = LAYOUT.oldVillage.mountainGate;
    return (
      map === "oldVillage" &&
      z === gate.z &&
      x >= gate.x - 1 &&
      x <= gate.x + gate.width - 2
    );
  }
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
      // 2026-09-04 Zeppelin 反饋「露比跟隨應該在隊伍最後面」——原本這裡
      // 是鏡射到村長另一側(x - 1.15)，跟歐文左右對稱不會撞在一起沒錯，
      // 但這段選屋橋段全程沿 z=17 這條路、單純往 -x 方向走(見
      // VILLAGE_TOUR 三個點 x=152→143→137)，鏡射意味著露比落在
      // "x - 1.15"，比村長更靠近 -x 方向，等於走在隊伍最前面，不是
      // 「隊伍最後面」。改成跟歐文同一側、但 x 偏移量更大(2.3，歐文的
      // 兩倍)，讓她排在隊伍最尾端；z 另外錯開一點點(0.15 而非 0.45)
      // 避免跟歐文的踏點完全重疊。
      dayTwoMorningEvent.holdPositions.artist = {
        x: mayorNpc.mesh.position.x + 2.3,
        z: mayorNpc.mesh.position.z + 0.15,
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

// ==============================================================
// Day 2 後半——「隔壁那個奇怪的人」：露比(藝術家)個人事件。露比在
// beginMountainRoute() 說完「先去放行李」那兩句台詞後，就已經推進到
// waiting_oldVillage、被釘在 ARTIST_EVENT_WAIT_POS（見 layout-maps.ts
// 該常數旁的說明）；木匠事件 completeDayTwoMorningEvent() 結束後直接
// 接上她的開場白（2026-09-04 改成自動接續，不再等玩家自己走過去碰觸
// 發——見 completeDayTwoMorningEvent() 那邊的說明）。跟上面木匠/村長
// 那條主線共用同一套 loadEventMap/showDialogSequence 寫法，但用獨立
// 的 artistQuest.stage 當狀態機、獨立的 "rubyEvent" 時間暫停來源
// (time-pause.ts)，不跟 dayTwoMorningEvent 混在一起——那個狀態機早就
// 跑到 "complete" 定住了，這是完全獨立的第二段個人事件。
// ==============================================================

const pigmentCg = (text: string) => ({
  ...artist(text),
  cg: "day2Artist-01",
});
// 2026-09-04：Zeppelin 給了研磨顏料戲後半的差分圖(她抬頭看向主角、
// 提議花田那幾句)，跟 pigmentCg() 同一個寫法，只是換一張 cg——
// setDialogCg() 偵測到 currentCgId 從 day2Artist-01 換成 -02 時，會自動
// 走「差分轉場」那個半秒交叉淡入淡出分支(不是黑幕重新進場)，不用額外
// 處理轉場。
const pigmentCg2 = (text: string) => ({
  ...artist(text),
  cg: "day2Artist-02",
});

// 上山採花的傳送落點——劇本給的座標，跟 VILLAGE_TOUR 那種場景標記同一
// 種「直接寫死、來源是 Zeppelin 給的劇本」寫法。
const RUBY_MOUNTAIN_SPOT = { x: 22, z: 59 };

export function handleArtistWaitTouch() {
  if (dialogQueue.length) return;
  if (artistQuest.stage !== "waiting_oldVillage") return;
  artistQuest.stage = "intro"; // 立刻推進，防止玩家在對話開始前重複觸發
  startArtistPersonalEvent();
}

// 2026-09-04：露比開場戲的「發現」演出——Zeppelin 給的分鏡：她先站定
// 露臉、主角轉頭注意到她、再走過去站到她左邊，才接上原本的對話。跟
// 上面三輪除錯不同，那時候的疑問「她到底有沒有畫出來」已經由截圖證實
// 沒有問題（CG 立繪正常顯示），這裡純粹是把演出分鏡做出來，除錯用的
// console.log 已經拿掉。
//
// 走路這段沒有沿用 startGuidedWalk()——那個函式寫死操控 mayor
// (`npcs.find(npc => npc.id === "mayor")`)，是給「NPC 領頭、主角跟隨」
// 的多人隊伍走位設計的，這裡反過來是「主角自己走一小段」，硬套會需要
// 動到那份共用邏輯、風險比自己寫一個小工具大。距離只有一格，用一個
// 獨立的 rAF 迴圈線性內插 gameState.player 的位置即可，跟主線的
// A*/路徑系統無關，不會互相干擾。
function walkPlayerTo(target: { x: number; z: number }, onDone: () => void) {
  const start = {
    x: gameState.player.position.x,
    z: gameState.player.position.z,
  };
  const dx = target.x - start.x;
  const dz = target.z - start.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) {
    onDone();
    return;
  }
  gameState.player.rotation.y = Math.atan2(dx, dz) + Math.PI;
  // 跟 game-loop.ts 日常排程 NPC 同一個走路速度(1.6 格/秒)，走起來的
  // 節奏才會跟遊戲平常的走路速度一致，不會忽快忽慢。
  const speed = 1.6;
  const durationMs = (dist / speed) * 1000;
  const startTime = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - startTime) / durationMs);
    gameState.player.position.x = start.x + dx * t;
    gameState.player.position.z = start.z + dz * t;
    // 跟本檔案其他地方、game-loop.ts 逐幀釘位那幾段同一個順序：
    // animateWalk() 會直接覆蓋 position.y 成踏步彈跳量，一定要先呼叫、
    // 再用 += 疊加地形高度，見 game-loop.ts 2026-09-04 那則說明。
    animateWalk(gameState.player, t < 1, gameState.elapsed);
    gameState.player.position.y +=
      oldVillageGroundY(
        gameState.player.position.x,
        gameState.player.position.z,
      ) + 0.03;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onDone();
    }
  }
  requestAnimationFrame(step);
}

function startArtistPersonalEvent() {
  gameState.cutsceneActive = true;
  setTimePauseSource("rubyEvent", true);
  // 鐮刀本來就是新遊戲預設起始工具(sickle: true)，這裡再設一次是
  // 保險、不是真的解鎖——跟劇本「[獲得鐮刀]」的敘事對上，即使玩家不知
  // 為何身上沒有鐮刀(例如之後改了預設值)，這場戲結束後也一定會有。
  inventory.tools.sickle = true;
  showDialogSequence(
    [
      "[藝術家站在隔壁空屋前，盯著外牆]",
      { ...artist("「……」"), comicCue: { actorId: "artist", kind: "..." } },
    ],
    () => {
      // 主角注意到隔壁的露比，轉向她(她站在 ARTIST_EVENT_WAIT_POS，
      // 東側)、露出驚訝反應，再走過去站到她左邊(西側一格)，跟
      // Zeppelin 給的分鏡一致。
      gameState.player.rotation.y = FACING_ANGLE.right;
      showDialogSequence(
        [cue("[主角轉頭，注意到隔壁站著一個人]", "player", "!")],
        () => {
          walkPlayerTo(
            { x: ARTIST_EVENT_WAIT_POS.x - 1, z: ARTIST_EVENT_WAIT_POS.z },
            () => continueArtistPersonalEventDialogue(),
          );
        },
      );
    },
  );
}

function continueArtistPersonalEventDialogue() {
  showDialogSequence(
    [
      artist("「你覺得這面牆是白色的嗎？」"),
      hero("「……？」"),
      artist("「我覺得不是。」"),
      artist("「有一點灰、一點黃……下面還留著雨水流過的顏色。」"),
      "[她終於轉過頭]",
      artist("「啊。」"),
      artist("「你是剛才港口那個牧場主。」"),
      artist("「抱歉，忘了自我介紹。」"),
      artist("「我是今天搬來的藝術家，露比。」"),
      artist("「其實我本來帶了顏料。」"),
      artist("「但山上應該會有花。」"),
      artist("「突然覺得，用帶來的顏料畫這座島，好像有點可惜。」"),
      hero("「？」"),
      artist("「有些植物可以做成天然顏料。」"),
      artist("「既然要畫這座島……」"),
      artist("「我想試試看，用這座島自己的顏色。」"),
      cue("[主角看向窗外／山的方向，一臉躍躍欲試]", "player", "!"),
      artist("「……你該不會也想去看看？」"),
      "[主角點頭]",
      artist("「這樣啊。」"),
      "[翻找拿出鐮刀]",
      artist("「那這把先給你——直接用手拔不太好。」"),
      systemDialog("獲得鐮刀"),
      artist("「那麼，我們一起去吧。」"),
    ],
    beginFlowerMountainWalk,
  );
}

// 2026-09-04 Zeppelin 反饋「主角沒有用走路的過去」——原本這裡是
// loadEventMap() 黑屏直接傳送到 RUBY_MOUNTAIN_SPOT，改成比照
// beginMountainRoute()(木匠/村長那段上山教學)同一套做法：解除演出鎖，
// 讓玩家自由走去山門，藝術家用 escort trail 跟在後面(見 game-loop.ts
// 的 updateArtistMountainEscortTrail)，實際踩過山門才會走進 mountain
// 地圖(WORLD_MAP_TRANSITIONS 既有的一般地圖銜接，不是這裡另外寫的)。
// 進山之後的收尾(從入口走到 RUBY_MOUNTAIN_SPOT 這一小段)交給
// settleArtistAtFlowerSpot()，由 updateRubyEvent() 每幀輪詢
// gameState.currentMapName 是否已經變成 "mountain" 來觸發。
function beginFlowerMountainWalk() {
  // 不用另外呼叫 setTimePauseSource("guidedGameplay", true)——
  // startArtistPersonalEvent() 一開場就設了 setTimePauseSource(
  // "rubyEvent", true)，涵蓋整段個人事件(intro 一路到
  // completeArtistPersonalEvent() 才關掉)，這裡不需要也不該再疊一個
  // 沒有對應關閉時機的 guidedGameplay 來源，不然事件結束後遊戲時間會
  // 卡死不動。
  artistQuest.stage = "walkingToMountain";
  gameState.cutsceneActive = false;
}

// 玩家踩過山門、實際進到 mountain 地圖後才會被 updateRubyEvent() 呼叫
// 一次(見該函式)。這裡先把藝術家「安置」在地圖入口附近(跟
// startMountainGatheringTutorial() 用 holdNpcsAt 把村長/木匠釘在
// LAYOUT.mountain.townArrival 旁同一個道理——escort trail 只在
// oldVillage 有效，過門那一刻起她本來就不會再跟著玩家的即時座標)，
// 再用 walkArtistTo() 讓她自己從入口走到 RUBY_MOUNTAIN_SPOT 站定，
// 走到了才進對話、進 gatheringFlowers，跟原本傳送版一樣的收尾台詞。
function settleArtistAtFlowerSpot() {
  artistQuest.stage = "walkingToFlowerSpot";
  gameState.cutsceneActive = true;
  const artistNpc = npcs.find((n) => n.id === "artist");
  if (artistNpc) {
    const arrival = LAYOUT.mountain.townArrival;
    artistNpc.mesh.visible = true;
    artistNpc.mesh.position.set(
      arrival.x + 1,
      mountainGroundY(arrival.x + 1, arrival.z),
      arrival.z,
    );
    artistNpc.mesh.rotation.y = Math.PI / 2;
    artistNpc.path = null;
    artistNpc.lastTargetKey = null;
  }
  walkArtistTo(RUBY_MOUNTAIN_SPOT, mountainGroundY, () => {
    // 原本傳送版是直接把她面向設成 Math.PI/2(側對玩家、面向花叢那側)，
    // 用走的版本走到定點後保留這個設計好的最終朝向，不要留在剛剛走路
    // 時面朝的方向(那只是路徑方向，跟劇本設計的站姿無關)。
    if (artistNpc) artistNpc.mesh.rotation.y = Math.PI / 2;
    showDialogSequence(
      [
        artist("「山腳和上面的幾處平台都有野花。」"),
        artist("「靠近花叢使用鐮刀，就能採下來。」"),
        artist("「如果可以的話，幫我找三種顏色。」"),
      ],
      () => {
        artistQuest.stage = "gatheringFlowers";
        // 跟 startMountainGatheringTutorial() 的 woodStart/stoneStart 同一
        // 招：拍一份快照，之後只算「這次新採到」的顏色，不是終身累積。
        artistQuest.flowerStartCounts = { ...inventory.wildflowers };
        gameState.cutsceneActive = false;
        renderFlowerColorObjective();
      },
    );
  });
}

// 這次自由採集期間「新增」了幾種顏色(物種)——跟 gatheredWood()/
// gatheredStone() 同一種「跟起始快照比對」寫法。
function gatheredFlowerColors() {
  const start = artistQuest.flowerStartCounts;
  if (!start) return [];
  return FLOWER_SPECIES.filter(
    (species) => inventory.wildflowers[species.id] > (start[species.id] ?? 0),
  );
}

function renderFlowerColorObjective() {
  const el = document.getElementById("dayTwoObjective");
  if (!el) return;
  // 跟 renderGatherObjective() 同一個 2026-09-02 修過的教訓：對話/演出
  // 還沒關掉時提示框先別跳出來，不然會蓋住立繪。
  if (
    artistQuest.stage !== "gatheringFlowers" ||
    dialogQueue.length > 0 ||
    gameState.cutsceneActive
  ) {
    el.style.display = "none";
    return;
  }
  const found = gatheredFlowerColors();
  const label = found.length
    ? `已找到：${found.map((species) => species.pigmentColor).join("、")}`
    : "還沒找到任何顏色";
  el.textContent = `任務：幫露比尋找三種顏色的野花（${label}）${found.length}/3`;
  el.style.display = "block";
}

function finishFlowerGathering() {
  if (artistQuest.stage !== "gatheringFlowers") return;
  artistQuest.stage = "returning";
  gameState.cutsceneActive = true;
  renderFlowerColorObjective();
  showDialogSequence(
    [artist("「湊到了，那麼，我們回去吧。」")],
    startPigmentScene,
  );
}

function startPigmentScene() {
  loadEventMap(
    "oldVillage",
    { x: ARTIST_EVENT_WAIT_POS.x, z: ARTIST_EVENT_WAIT_POS.z + 1 },
    () => {
      gameState.player.rotation.y = 0; // 面朝上，正對站在原地等的露比
      const artistNpc = npcs.find((n) => n.id === "artist");
      if (artistNpc) {
        artistNpc.mesh.visible = true;
        artistNpc.mesh.position.set(
          ARTIST_EVENT_WAIT_POS.x,
          oldVillageGroundY(ARTIST_EVENT_WAIT_POS.x, ARTIST_EVENT_WAIT_POS.z),
          ARTIST_EVENT_WAIT_POS.z,
        );
        artistNpc.mesh.rotation.y = Math.PI; // 面朝玩家走回來的方向(南)
        artistNpc.path = null;
        artistNpc.lastTargetKey = null;
      }
      showDialogSequence([artist("「跟我來，我弄給你看。」")], () => {
        void runBlackTransition("short", () => {
          showDialogSequence(
            [
              "[藝術家把其中一朵花揉碎／研磨]",
              pigmentCg("「你看。」"),
              "[顏色逐漸滲出]",
              pigmentCg("「這就是我想要的。」"),
              pigmentCg("「商店買得到更穩定、更漂亮的顏料。」"),
              pigmentCg("「但這個顏色只屬於這裡。」"),
              pigmentCg("「不過……」"),
              pigmentCg("「每次缺顏料都爬一趟山，好像也不是辦法。」"),
              "[看向主角]",
              // 從這句開始換成 day2Artist-02 差分(她抬頭看向主角的表情)，
              // 到這場戲結束為止都用這張，跟前面研磨顏料的 day2Artist-01
              // 分開。
              pigmentCg2("「牧場不是有空地嗎？」"),
              pigmentCg2("「你可以考慮種一片自己的花田。」"),
              // 系統提示保留 cg，不然這一句會把 setDialogCg 呼叫成 null，
              // 中間硬插一次淡出/淡入，跟前後的差分連續戲不搭。
              // 2026-09-04：花田系統(livingArea 小花園原址，見
              // game-state.ts 的 flowerBedState/plantFlowerBed())已經
              // 上線，這句提示現在對應真的可種/可收的花圃，不再只是
              // 純敘事鋪陳。
              // { ...systemDialog("野花與部分花卉可以種植"), cg: "day2Artist-02" },
              pigmentCg2("「到時候，我可能會常去找你。」"),
            ],
            completeArtistPersonalEvent,
          );
        });
      });
    },
  );
}

// 露比個人事件整場戲(port 相遇→木匠戲→黑屏接上→山上採花→回村研磨顏
// 料)跑下來，遊戲內時間其實只是被 setTimePauseSource("rubyEvent", true)
// 暫停在木匠戲結束的時間點，不會照實際跑的時間流逝——事件結束後直接
// 解除暫停，時間感會很奇怪(明明劇情演了大半天，時鐘卻還停在早上)。
// Zeppelin 要求「露比事件結束後強制時間改到1500」，比照 prologue.ts
// 序章結束時同款寫法(FREE_TIME_PHASE = 15/24，見那邊 beginStage("done")
// 收尾那段)——差別是序章發生在第 0 天，直接用 dayLength*phase 就好；
// 這裡是第二天以後，要保留 gameState.currentDay 這個日期部分，只改
// 「這一天內的時刻」，不然會把 elapsed 拉回第 0 天，等於倒退好幾天。
const RUBY_EVENT_END_PHASE = 15 / 24; // 15:00
function completeArtistPersonalEvent() {
  addAffectionReward("artist", "personalEvent");
  artistQuest.stage = "complete";
  gameState.cutsceneActive = false;
  setTimePauseSource("rubyEvent", false);
  gameState.elapsed =
    gameState.currentDay * dayLength + dayLength * RUBY_EVENT_END_PHASE;
  gameState.currentPhase = RUBY_EVENT_END_PHASE;
}

// game-loop.ts 每幀呼叫，跟 updateDayTwoWalkFollowers() 平行、各管各的
// 狀態機——採花進度輪詢 + HUD 更新 + 湊滿三色自動觸發回程。
export function updateRubyEvent() {
  // 玩家自由走過山門、WORLD_MAP_TRANSITIONS 已經把地圖切成 mountain
  // 了才觸發一次——這裡只是輪詢地圖名稱，不是觸碰事件，跟
  // updateDayTwoWalkFollowers() 判斷 dayTwoMorningEvent.phase ===
  // "mountainRoute" && currentMapName === "mountain" 同一招。
  // settleArtistAtFlowerSpot() 進來第一行就會把 stage 切成
  // "walkingToFlowerSpot"，下一幀這個條件自然不再成立，不會重複觸發。
  if (
    artistQuest.stage === "walkingToMountain" &&
    gameState.currentMapName === "mountain"
  ) {
    settleArtistAtFlowerSpot();
  }
  if (artistQuest.stage === "gatheringFlowers") {
    renderFlowerColorObjective();
    if (gatheredFlowerColors().length >= 3) {
      finishFlowerGathering();
    }
  }
}
