import * as THREE from "three";
import { dayLength, gameState } from "./game-state";
import { LAYOUT } from "./layout-maps";
import { showDialogSequence } from "./dialogue";
import { npcs, npcGroup } from "./npc-runtime";
import { prologueRefs } from "./scene-registries";
import { updateCameraFrustum } from "./scene-sky";
import { isCameraShotsPlaying, isCameraAdjustModeActive } from "./cutscene-camera";
import { animateWalk } from "./humanoid";
import { getScheduleTarget } from "./npc-defs";

// ==============================================================
// 序幕：開場第一天演出——主角乘（makePortScene() 裡本來就停在港口的
// 那艘登陸艇渡輪）船抵達港口。
//
// 設計原則：不另外蓋第二艘船/第二塊跳板，直接「借用」makePortScene()
// 已經建好、平常整場遊戲都靜靜停在碼頭的 ferry/gangplank 這兩個
// Object3D（透過 scene-registries.ts 的 prologueRefs 拿參照）。演出
// 開始時把它們暫時搬離「停靠位」(船推到外海、跳板收合貼在船頭)，演出
// 結束時兩者都會回到 makePortScene() 原本蓋出來的靜止狀態——所以這場
// 戲對其餘遊戲時間完全沒有副作用，跟這艘渡輪平常給人的印象(補給船固定
// 停靠)也不衝突：玩家看到的其實就是這艘船「難得跑一趟」而已。
//
// 觸發：main.ts 開局時如果偵測不到存檔(hasSave() 為否)，就走這條而不是
// 直接進生活區——見 shouldPlayPrologueOnBoot()。另外留一顆 F8 除錯熱鍵
// (input-save.ts)方便重播，不用每次都清存檔，見 previewPrologue()。
//
// 移動期間鎖住 WASD 用的是 gameState.cutsceneActive，不是走
// isGameTimePaused()那條路——那個會把 dt 鎖成 0，連船/跳板的補間動畫
// 也會一起凍結。對話開著的段落(dt 本來就會是 0，見 game-clock.ts)不受
// 影響，正好也符合「唸台詞的時候船不該在動」的要求。
// ==============================================================

const SAVE_KEY = "meadowtide.save.default";

export function shouldPlayPrologueOnBoot(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) === null;
  } catch (err) {
    // 存取 localStorage 失敗(例如無痕模式擋掉)——保守起見不要打斷正常
    // 開局，直接當作「有存檔」處理，走原本進生活區那條路。
    return false;
  }
}

// 2026-08-26 標題畫面(title-screen.ts)用——跟上面
// shouldPlayPrologueOnBoot() 邏輯上是同一個判斷的反面(有沒有存檔)，只是
// 用途不同：這支是給主選單決定要不要顯示「繼續遊戲」按鈕，不是給開局
// 自動分支用，兩支各自留著語意比較清楚，呼叫端不用自己記得要加驚嘆號。
export function hasSaveData(): boolean {
  return !shouldPlayPrologueOnBoot();
}

type Stage =
  | "inactive"
  | "atSea"
  | "approaching"
  | "rampLowering"
  | "walking"
  | "captainWalking"
  | "greeting"
  | "done";

let stage: Stage = "inactive";
let stageProgress = 0; // 0~1，每個計時型階段自己歸零重算
let waypoints: THREE.Vector3[] = [];
let waypointIndex = 0;
let captainWaypointIndex = 0;
let captainWaypoints: THREE.Vector3[] = [];
let greetingDialogueStarted = false; // 防止 greeting 階段每幀重複呼叫 showDialogSequence
let hasTouchedDock = false; // 「腳踏上碼頭」的一次性判定，見 walking 階段
// 2026-08-26 第六輪反饋「主角剛落地是陷進碼頭的」——查出來的真正原因：
// game-loop.ts 的 animate() 每幀在 updatePrologueCutscene() 之後，
// 不管 cutsceneActive 是不是 true，都還是會呼叫 animateRun()/
// animateSit()(見 humanoid.ts)，而這兩個函式會直接「覆寫」
// gameState.player.position.y 成走路/待機用的小幅 bob 值(0~0.055 或
// ±0.01)——不是相對疊加，是整個蓋掉。等於這裡辛辛苦苦算出來的甲板/
// 跳板/碼頭高度，每一幀都會被走路動畫的 bob 蓋成幾乎貼地的數字，看
// 起來就像角色整段演出都「陷進」場景裡，不是只有最後落地那一刻。用
// lastPlayerY 記住「這幀真正該有的 Y」，配合下面 syncLastPlayerY()
// 在每次寫 position.y 之後存一份，game-loop.ts 呼叫完
// animateRun()/animateSit() 之後再呼叫 reapplyProloguePlayerY() 蓋
// 回去，兩邊「蓋 Y」的順序反過來，序幕的高度才能是最後贏的那個。
let lastPlayerY = 0;
// 序幕演出用的固定鏡頭縮放——見 startPrologueScene() 內的設定。
const PROLOGUE_ZOOM = 5;
const PROLOGUE_MAYOR_X = 3;
const PROLOGUE_MAYOR_Z = 22;
const PROLOGUE_CAPTAIN_X = 5;
const PROLOGUE_CAPTAIN_Z = 21;
const PROLOGUE_HOUR = 10;
const PROLOGUE_PHASE = PROLOGUE_HOUR / 24;

function lockPrologueDateTime() {
  gameState.elapsed = dayLength * PROLOGUE_PHASE;
  gameState.currentDay = 0;
  gameState.currentPhase = PROLOGUE_PHASE;
  gameState.currentSeason = 0;
}

function lockPrologueZoom() {
  if (gameState.zoom === PROLOGUE_ZOOM) return;
  gameState.zoom = PROLOGUE_ZOOM;
  updateCameraFrustum();
}

function placePrologueMayor() {
  const mayor = npcs.find((npc) => npc.id === "mayor");
  if (!mayor) return;
  mayor.mesh.visible = true;
  mayor.mesh.position.set(PROLOGUE_MAYOR_X, LAYOUT.port.elevation, PROLOGUE_MAYOR_Z);
  // 人形正面是本地 -Z；面向世界 +X（畫面右方）需轉 -90 度。
  mayor.mesh.rotation.y = -Math.PI / 2;
}

// 演出參數——先求「有動作、順序對」，實際格數/秒數之後看畫面再調，
// 都寫成具名常數方便找。
// 2026-08-26 Zeppelin 反饋「船開頭再往右20格」——原本 18 再加 20，
// 外海起始點推得更遠，鏡頭鎖在船上時比較看得出「船正在從遠處開過來」
// 的距離感，不是一開始就幾乎貼著碼頭。
const SEA_OFFSET_X = 38; // 演出開場時，船比停靠位再往外海(世界 +X)推幾格
const APPROACH_SECONDS = 4.5; // 船從外海滑回停靠位的時間
const RAMP_LOWER_SECONDS = 1.4;
// 2026-08-26 第五輪把這裡從 +π/2 改成 -π/2，是照 Zeppelin 當時看到的
// 畫面調的、沒有重新推導；但同一輪其實還修了另一個更根本的 bug
// (bowWorldPoint() 的 ferry.updateMatrixWorld() 過期矩陣問題)，兩個
// 改動疊在一起，那次看到的畫面很可能同時被舊 bug 污染，不能單純採信
// 「-π/2 是對的」這個結論。第六輪反饋「再翻180度」+「變成從下往上
// 翻」正好對得上：用向量代數重新推一次——局部 (length,0) 這個點繞
// rotation.z 轉 θ，會落在世界偏移 (length·cosθ, length·sinθ)；跳板
// 折收貼船頭、封住艙口時，自由端(local x=length)應該指向世界 +Y(往上
// 收，蓋住開口)，也就是 θ=+π/2；-π/2 會讓它指向世界 -Y(往下、穿過船身
// /沒入水裡)，放下動畫因此變成從水裡由下往上翻回來，正是「從下往上翻」
// 那句反饋在講的畫面。改回 +π/2——這次是重新推導出來的，不是單純再翻
// 一次；如果這輪之後方向還是不對，問題就不是角度正負號，得往
// GANGPLANK_BOW_LOCAL 選錯邊或旋轉軸本身查。
const RAMP_RAISED_ROTATION_Z = Math.PI / 2; // 收合貼船頭(90 度)時的角度
const WALK_SPEED = 2.6; // 格/秒，下船這段用的是自己算的位移，不吃碰撞

// 2026-08-26 Zeppelin 反饋「把主角模型放到船頭並對著碼頭」——原本站
// 甲板中段(local x=0.3，偏船尾側)，改到船頭(local x=-1.3，pen 前緣
// -1.1 跟船體前緣 -1.8 之間，不會卡進動物欄杆，也還沒踩到跳板船頭端
// -1.6)。Y=0.5 是甲板高度(makeCargoShip() 的不變量)，Z=0 置中。
const PLAYER_BOW_LOCAL = new THREE.Vector3(-1.3, 0.5, 0);
// 2026-08-26 第三輪反饋「行駛時跳板方向反了、放下時關節應該從船頭轉」
// ——這裡故意用 hull 邊緣「真正的」局部座標 -1.8(跟 makePortScene()
// 算跳板船端世界座標時用的 ferryHullHalfLength 完全對齊，不能像上一輪
// 那樣隨手內縮成 -1.78)，因為這個點現在要當旋轉動畫真正的鉸鏈原點
// (見 rampLowering 階段的整段說明)，差 0.02 會讓 approaching 結束、
// 開始旋轉那一刻跳板肉眼可見地跳一下。
const GANGPLANK_BOW_LOCAL = new THREE.Vector3(-1.8, 0.5, 0);

// 2026-08-26 第二輪反饋「Z 不對」——查出來是 ferry.rotation.y=0.03 這個
// 小小的船體偏航角，經過 localToWorld() 之後會讓局部 z=0 的點在世界
// 座標裡混進一點點 x 分量(旋轉矩陣的關係)，換算下來大概偏移 0.1 格
// 上下，肉眼看不出來是哪裡歪的，但走位/跳板的 Z 因此對不齊。跳板本身
// 是直接寫死 world z=port.ferry.z(沒有經過旋轉)，所以統一規則：凡是
// 演出用到的「甲板/船頭」世界座標，一律把 z 強制對齊 LAYOUT.port.
// ferry.z，不採信 localToWorld() 算出來的 z 分量。
function bowWorldPoint(localPoint: THREE.Vector3): THREE.Vector3 {
  const ferry = prologueRefs.ferry!;
  // 2026-08-26 第五輪反饋「初始沒看到主角跟船板，懷疑Z沒有碰撞對到
  // 船面」——查出來的真正原因：這個專案的 three@0.128.0 版本，
  // localToWorld() 不會自動重算 matrixWorld(這行為是後來版本才加的)，
  // 剛改完 ferry.position 就馬上呼叫 localToWorld()，讀到的其實是上
  // 一幀渲染時的舊矩陣——船從停靠位瞬間跳到外海(SEA_OFFSET_X=38)那
  // 一瞬間差距最大，算出來的甲板/跳板世界座標會停在「船還沒跳走之前」
  // 的舊位置，跟已經鎖定到船新位置的鏡頭對不上，人跟跳板因此都落在
  // 畫面外。強制在這裡先手動刷新一次矩陣，不依賴 renderer 下一輪
  // render() 才會做的自動更新。
  ferry.updateMatrixWorld(true);
  const world = ferry.localToWorld(localPoint.clone());
  world.z = LAYOUT.port.ferry.z;
  return world;
}

// 跟 game-loop.ts 主迴圈的轉向平滑用同一條「走最短路徑」公式，避免
// 兩個角度端點數值差太遠時，普通線性內插(THREE.MathUtils.lerp)會繞
// 遠路(例如從 -90 度轉到 200 度，直接內插會經過 0 度整整轉 290 度，
// 走最短路徑只需要反方向轉 70 度)。
function lerpAngle(from: number, to: number, t: number): number {
  const delta = (((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return from + delta * t;
}

function faceDirection(dx: number, dz: number) {
  // 跟 game-loop.ts 主移動邏輯同一條公式：模型鼻子朝本地 -Z，所以要多轉
  // 半圈，見那邊「臉會永遠朝向來時路」的註解。
  if (dx === 0 && dz === 0) return;
  gameState.player.rotation.y = Math.atan2(dx, dz) + Math.PI;
}

// 見上面 lastPlayerY 的註解——每次寫完 gameState.player.position.y 之後
// 呼叫，把「這幀真正該有的高度」存起來，給 reapplyProloguePlayerY() 用。
function syncLastPlayerY() {
  lastPlayerY = gameState.player.position.y;
}

// game-loop.ts 在 animateRun()/animateSit() 之後呼叫：那兩個函式的走路
// /待機 bob 動畫會覆寫 position.y，這裡負責蓋回序幕自己算的高度。非
// 演出期間(cutsceneActive 為否)整段是 no-op，不影響正常移動的地形/
// bob 疊加。
export function reapplyProloguePlayerY() {
  if (!gameState.cutsceneActive) return;
  gameState.player.position.y = lastPlayerY;
}

// 跳板還收在船頭那幾個階段(atSea/approaching)每幀呼叫——不是真的用
// THREE 的 object.add() 把跳板掛成 ferry 的子物件：那樣做的話跳板的
// 尺寸還得另外處理 ferry.scale(2.05,1.7,1.7) 的縮放抵消(跳板的長寬是
// 已經算好的「真實世界尺寸」，直接掛上去會被 ferry 的 scale 再放大一
// 次)，反而更麻煩。改成每幀自己用 bowWorldPoint() 算出「此刻船頭在
// 哪」，直接把 gangplank.position 設過去，效果一樣(跟著船走)，不用碰
// 縮放。
function syncGangplankToBow() {
  const gangplank = prologueRefs.gangplank!;
  gangplank.position.copy(bowWorldPoint(GANGPLANK_BOW_LOCAL));
  gangplank.rotation.z = RAMP_RAISED_ROTATION_Z;
}

// 2026-08-26 第八輪：makeGangplank() 的扶手/欄杆柱子物件都在 userData
// 存了 gangplankRailBaseY(見 props.ts)。立起貼船頭跟放下停靠這兩個
// 狀態的 rotation.z 不一樣，同一個扶手局部位移沒辦法兩邊都好看——
// 這裡動態把扶手搬到反面(flipped=true，立起貼船頭時用)或搬回原本
// 蓋好的那面(flipped=false，放下停靠時用)，只動這幾個有標記的子物件，
// 木板本體不受影響。
function setGangplankRailFlip(flipped: boolean) {
  const gangplank = prologueRefs.gangplank;
  if (!gangplank) return;
  gangplank.traverse((child) => {
    const baseY = child.userData.gangplankRailBaseY;
    if (typeof baseY === "number") {
      child.position.y = flipped ? -baseY : baseY;
    }
  });
}

// 演出用到的所有世界座標，等船真的停到 rest 狀態、跳板也放到底之後才能
// 算——呼叫時機是 rampLowering 結束、要進 walking 階段前。
function computeWaypoints() {
  const gangplank = prologueRefs.gangplank!;
  // 甲板上、船頭附近——主角站著的原地，下船的第一步。
  const onDeck = bowWorldPoint(PLAYER_BOW_LOCAL);
  // 跳板船頭端(hull -X 邊緣)附近，準備踏上跳板前的最後一步。
  const rampTop = bowWorldPoint(new THREE.Vector3(-1.6, 0.5, 0));
  // 跳板碼頭端——直接讀 gangplank 自己這時候的 position(已經放到底、
  // 等於 prologueRefs.gangplankRestPosition)，不用重算一次。這個點是
  // 「腳踏上碼頭」的判定點，見 walking 階段 hasTouchedDock 那段。
  const rampBottom = gangplank.position.clone();
  // 碼頭平台上，稍微再往內走一點、離開跳板正下方，準備跟村長/船長碰頭。
  const dockGreet = new THREE.Vector3(
    rampBottom.x - 1.6,
    LAYOUT.port.elevation,
    rampBottom.z,
  );
  waypoints = [onDeck, rampTop, rampBottom, dockGreet];
  // 主角完成下船後，船長只需走碼頭上的最後一格；船上與跳板段不再
  // 重播，避免模型座標與渡輪局部座標混用而斜切到右上。
  captainWaypoints = [
    new THREE.Vector3(PROLOGUE_CAPTAIN_X, LAYOUT.port.elevation, 22),
    new THREE.Vector3(PROLOGUE_CAPTAIN_X, LAYOUT.port.elevation, PROLOGUE_CAPTAIN_Z),
  ];
  waypointIndex = 0;
  captainWaypointIndex = 0;
  hasTouchedDock = false;
}

function beginStage(next: Stage) {
  stage = next;
  stageProgress = 0;
  if (next !== "greeting") greetingDialogueStarted = false;
}

function startWelcomeDialogue() {
  const mayor = npcs.find((n) => n.id === "mayor");
  const captain = npcs.find((n) => n.id === "captain");
  const dockRamp = prologueRefs.gangplank!.position;
  npcGroup.visible = true;
  if (captain) {
    // 船長留在跳板邊——演出設定是他正在把纜繩繫上，這一段沒有真的做
    // 繫繩動畫，用站位暗示就好。
    captain.mesh.visible = true;
    captain.mesh.position.set(
      PROLOGUE_CAPTAIN_X,
      LAYOUT.port.elevation,
      PROLOGUE_CAPTAIN_Z,
    );
    captain.mesh.rotation.y = Math.PI;
  }
  if (mayor) {
    // 村長平常掛在生活區，這場戲直接把她搬到港口——跟木匠事件的
    // startCarpenterDockScene() 是同一招(mayor.mesh.position.set 覆蓋
    // 掉她原本的行程表座標)，演出結束後她會照正常排程走，不用另外復原。
    placePrologueMayor();
  }
  showDialogSequence(
    [
      {
        text: "「啊，真的來了！我還怕你臨時反悔呢。」",
        speaker: "mayor",
        name: "村長",
      },
      {
        text: "「（把纜繩繫在柱子上，隨口接話）她可是天天來這邊等，比我還準時。」",
        speaker: "captain",
        name: "船長",
      },
      {
        text: "「（瞪他一眼，隨即轉回笑臉）路上還順利吧？行李就這些？跟我來，先帶你認識一下島上的地方。」",
        speaker: "mayor",
        name: "村長",
      },
    ],
    () => {
      const captain = npcs.find((npc) => npc.id === "captain");
      if (captain) {
        captain.mesh.position.set(
          PROLOGUE_CAPTAIN_X,
          LAYOUT.port.elevation,
          PROLOGUE_CAPTAIN_Z,
        );
        captain.mesh.rotation.y = Math.PI;
        const scheduleTarget = getScheduleTarget(captain.schedule, gameState.currentPhase);
        captain.lastTargetKey = scheduleTarget.x + "," + scheduleTarget.z;
        captain.path = [];
        captain.pathIndex = 0;
      }
      beginStage("done");
      gameState.cutsceneActive = false;
    },
  );
}

function startShipDialogue() {
  showDialogSequence(
    [
      "[主角從口袋裡拿出一張翻到摺痕發白的傳單]",
      "『海風牧歌——徵求願意重新開始的人。免費修繕住宅・生活補助・船運銷售管道一應俱全。連絡人：村長』",
      "[看了不知道第幾遍了，還是有點不敢相信，真的會有人為了一座快要沒人的島，寫這種傳單]",
      {
        text: "「（回頭喊了一聲）欸，前面就到了，東西收一收吧！」",
        speaker: "captain",
        name: "船長",
      },
    ],
    () => {
      beginStage("approaching");
    },
  );
}

export function startPrologueScene(opts: { force?: boolean } = {}) {
  if (!opts.force && stage !== "inactive" && stage !== "done") return;
  if (!prologueRefs.ferry || !prologueRefs.gangplank) {
    console.warn(
      "[序幕] prologueRefs 還沒填好(需要先進過一次港口地圖)，跳過演出。",
    );
    return;
  }
  const fadeEl = document.getElementById("fade") as HTMLElement;
  gameState.cutsceneActive = true;
  lockPrologueDateTime();
  lockPrologueZoom();
  fadeEl.style.opacity = "1";
  setTimeout(() => {
    const ferry = prologueRefs.ferry!;
    ferry.position.x = prologueRefs.ferryRestX + SEA_OFFSET_X;
    // 跳板：不是隱藏、是「收合貼在船頭」，一路跟著船——見
    // syncGangplankToBow() 的註解。
    prologueRefs.gangplank!.visible = true;
    syncGangplankToBow();
    setGangplankRailFlip(true); // 立起貼船頭：扶手搬到反面，見上面註解
    npcGroup.visible = true;
    const captain = npcs.find((n) => n.id === "captain");
    if (captain) captain.mesh.visible = false; // 開船中，先不現身，靠岸繫繩時才出場
    placePrologueMayor();
    // 2026-08-26 第五輪反饋「不知道為什麼木匠跟著」——木匠本身平常不會
    // 出現在演出設定裡，會被拖上船大機率是 game-loop.ts 的
    // isCarpenterEscortActor 那段邏輯：只要 carpenterQuest.stage 是
    // "escorting"/"village_scene_done"(這輪測試的瀏覽器如果之前手動
    // 觸發過木匠碼頭事件，這個狀態會留著)，村長/木匠就會不看
    // .mesh.visible、直接跟著玩家的走位軌跡跑，序幕演出全程都在搬動
    // 玩家位置，木匠自然被拖上船。這裡先防守性地把他也關掉——如果
    // carpenterQuest 真的在 escorting 狀態，這行擋得住畫面(该分支不看
    // visible 就動位置，但 visible=false 至少不會被畫出來)，但沒有處理
    // 根本的狀態殘留；如果清一次瀏覽器的存檔/重新整理後木匠還是跟著，
    // 表示不是這個原因，要再往下查。
    const carpenter = npcs.find((n) => n.id === "carpenter");
    if (carpenter) carpenter.mesh.visible = false;
    gameState.player.position.copy(bowWorldPoint(PLAYER_BOW_LOCAL));
    gameState.player.visible = true;
    gameState.isMoving = false;
    // 面向碼頭方向(世界 -X)，像在等船靠岸。
    faceDirection(LAYOUT.port.basin.x - LAYOUT.port.ferry.x, 0);
    // 2026-08-26 Zeppelin 反饋「先鎖定事件預設zoom5，演出有需要調整時
    // 我會講」——開演出時直接把鏡頭縮放釘死在這個值，不管玩家(或上次
    // 除錯時)手動滾輪滾到哪個縮放，都從同一個已知距離開始。
    lockPrologueZoom();
    beginStage("atSea");
    fadeEl.style.opacity = "0";
    startShipDialogue();
  }, 400);
}

// 開發用：跳過存檔判斷、無條件從頭重播一次，方便邊看畫面邊調參數。
// 只能在已經站在港口地圖時使用——見 input-save.ts 的 F8。
export function previewPrologue() {
  startPrologueScene({ force: true });
}

// 2026-08-26 Zeppelin 反饋「鎖定鏡頭在船身上」——外海／靠岸這幾個
// 階段鏡頭要直接跟著船(prologueRefs.ferry.position)，不要間接透過
// gameState.player.position(雖然這幾個階段主角本來就是釘在船頭跟著
// 船一起動，理論上結果一樣，但 game-loop.ts 的鏡頭邏輯改成直接讀船
// 本身更明確、也不怕之後主角站位再調整就跟著跑掉)。走下船跟碼頭迎接
// 這兩個階段鏡頭要恢復正常跟著玩家，所以只在這三個「人還在船上」的
// 階段回傳 true。
export function isPrologueShipStage(): boolean {
  return stage === "atSea" || stage === "approaching" || stage === "rampLowering";
}

// game-loop.ts 的 animate() 每幀呼叫；只有 gameState.cutsceneActive 為真
// 時才有事做，其餘時間直接是個 no-op。
export function updatePrologueCutscene(dt: number) {
  if (!gameState.cutsceneActive) return;
  lockPrologueDateTime();
  // 2026-08-26 加了過場鏡頭系統(cutscene-camera.ts)之後才發現的衝突：
  // 這裡原本每幀都無條件把 zoom 釘回 PROLOGUE_ZOOM，開場 startPrologueScene()
  // 已經鎖過一次「已知距離」，但這裡每幀重覆鎖，會讓 F4 手動調整模式或
  // playCameraShots() 清單剛改完 zoom、下一幀馬上被這裡蓋回去，鏡頭看起來
  // 完全「動不了」。改成只在鏡頭系統沒有接管時才每幀重新確認/防守，鏡頭
  // 系統接管時 zoom 完全交給它決定。
  if (!isCameraShotsPlaying() && !isCameraAdjustModeActive()) {
    lockPrologueZoom();
  }
  const ferry = prologueRefs.ferry;
  const gangplank = prologueRefs.gangplank;
  if (!ferry || !gangplank) return;

  if (stage === "atSea") {
    // 對話還開著，船跟人都定住不動，位置在 startPrologueScene() 已經
    // 設好，這裡不用再動——單純等 startShipDialogue() 的 onComplete
    // 把 stage 推進到 approaching。
    gameState.player.position.y = bowWorldPoint(PLAYER_BOW_LOCAL).y;
    syncLastPlayerY();
    return;
  }

  if (stage === "approaching") {
    stageProgress = Math.min(1, stageProgress + dt / APPROACH_SECONDS);
    // ease-out：靠近碼頭時放慢，比等速滑行更有「船在減速靠岸」的感覺。
    const eased = 1 - Math.pow(1 - stageProgress, 2);
    ferry.position.x = THREE.MathUtils.lerp(
      prologueRefs.ferryRestX + SEA_OFFSET_X,
      prologueRefs.ferryRestX,
      eased,
    );
    // 跳板/主角都還「貼在船上」，跟著船一起平移。
    syncGangplankToBow();
    gameState.player.position.copy(bowWorldPoint(PLAYER_BOW_LOCAL));
    syncLastPlayerY();
    if (stageProgress >= 1) {
      ferry.position.x = prologueRefs.ferryRestX;
      syncGangplankToBow(); // 船到位那一幀先同步一次，鉸鏈點(船頭)之後就固定了
      beginStage("rampLowering");
    }
    return;
  }

  if (stage === "rampLowering") {
    stageProgress = Math.min(1, stageProgress + dt / RAMP_LOWER_SECONDS);
    // 2026-08-26 第三輪反饋「放下時關節應該從船頭轉，不是從碼頭」——
    // 改成真正的單軸鉸鏈旋轉，鉸鏈原點固定在船頭(gangplank.position，
    // 上一幀 syncGangplankToBow() 已經釘死，這裡不再動 position，只轉
    // rotation.z)。推導：靜態停靠版跳板是以「碼頭端」當原點、
    // rotation.z=gangplankRestRotationZ 時局部 +X 指向「船端」；同一條
    // 線段從「船端」當原點反過來看，角度就是同一個向量反過來，也就是
    // +π。所以從船頭轉的「放下後」角度是 gangplankRestRotationZ+π，
    // 不是 gangplankRestRotationZ 本身——這也正是「方向反了，要轉
    // 180 度」那句反饋在數學上對應的地方。「收合」角度沿用
    // RAMP_RAISED_ROTATION_Z(垂直朝上，貼住船頭封住開口)。轉到底之後
    // 跟原本靜態跳板(以碼頭端為原點)是同一條線段、同一塊板子，只是
    // 內部原點定義不同，視覺上完全等價，所以下面 stageProgress>=1 時
    // 直接切回 makePortScene() 原本算好的靜態值，沒有跳動。
    const restAngleFromBow = prologueRefs.gangplankRestRotationZ + Math.PI;
    gangplank.rotation.z = lerpAngle(
      RAMP_RAISED_ROTATION_Z,
      restAngleFromBow,
      stageProgress,
    );
    gameState.player.position.copy(bowWorldPoint(PLAYER_BOW_LOCAL));
    syncLastPlayerY();
    if (stageProgress >= 1) {
      gangplank.position.copy(prologueRefs.gangplankRestPosition!);
      gangplank.rotation.z = prologueRefs.gangplankRestRotationZ;
      setGangplankRailFlip(false); // 放下停靠：扶手搬回 makePortScene() 原本蓋好的那面
      computeWaypoints();
      beginStage("walking");
    }
    return;
  }

  if (stage === "walking") {
    const target = waypoints[waypointIndex];
    if (!target) {
      beginStage("greeting");
      return;
    }
    const dx = target.x - gameState.player.position.x;
    const dz = target.z - gameState.player.position.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
    if (dist <= Math.max(step, 0.03)) {
      gameState.player.position.x = target.x;
      gameState.player.position.z = target.z;
      gameState.player.position.y = target.y;
      syncLastPlayerY();
      // waypoints[2] 是跳板碼頭端(rampBottom)——腳真正踏上碼頭的判定
      // 點，之後(dockGreet)才是純粹走位，不算「下船」這件事本身。
      if (waypointIndex === 2 && !hasTouchedDock) {
        hasTouchedDock = true;
        console.info("[序幕] 已踏上碼頭");
      }
      waypointIndex++;
      if (waypointIndex >= waypoints.length) {
        const captain = npcs.find((npc) => npc.id === "captain");
        if (captain && captainWaypoints.length > 0) {
          captain.mesh.visible = true;
          captain.mesh.position.copy(captainWaypoints[0]);
          captainWaypointIndex = 1;
          beginStage("captainWalking");
        } else {
          beginStage("greeting");
        }
      }
    } else {
      const nx = dx / dist,
        nz = dz / dist;
      gameState.player.position.x += nx * step;
      gameState.player.position.z += nz * step;
      gameState.player.position.y = THREE.MathUtils.lerp(
        gameState.player.position.y,
        target.y,
        Math.min(1, step / dist),
      );
      syncLastPlayerY();
      faceDirection(nx, nz);
    }
    gameState.isMoving = true;
    return;
  }

  if (stage === "captainWalking") {
    gameState.isMoving = false;
    const captain = npcs.find((npc) => npc.id === "captain");
    const target = captainWaypoints[captainWaypointIndex];
    if (!captain || !target) {
      beginStage("greeting");
      return;
    }
    const dx = target.x - captain.mesh.position.x;
    const dz = target.z - captain.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
    if (dist <= Math.max(step, 0.03)) {
      captain.mesh.position.copy(target);
      const groundY = captain.mesh.position.y;
      animateWalk(captain.mesh, false, gameState.effectElapsed);
      captain.mesh.position.y += groundY;
      captainWaypointIndex++;
      if (captainWaypointIndex >= captainWaypoints.length) {
        captain.mesh.rotation.y = Math.PI;
        beginStage("greeting");
      }
    } else {
      const nx = dx / dist;
      const nz = dz / dist;
      captain.mesh.position.x += nx * step;
      captain.mesh.position.z += nz * step;
      captain.mesh.position.y = THREE.MathUtils.lerp(
        captain.mesh.position.y, target.y, Math.min(1, step / dist),
      );
      captain.mesh.rotation.y = Math.atan2(-nx, -nz);
      const groundY = captain.mesh.position.y;
      animateWalk(captain.mesh, true, gameState.effectElapsed);
      captain.mesh.position.y += groundY;
    }
    return;
  }

  if (stage === "greeting") {
    gameState.isMoving = false;
    if (!greetingDialogueStarted) {
      greetingDialogueStarted = true;
      startWelcomeDialogue();
    }
    return;
  }
}
