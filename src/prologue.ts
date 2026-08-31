import * as THREE from "three";
import {
  cropState,
  dayLength,
  gameState,
  inventory,
  STONE_NODES,
  WOOD_NODES,
} from "./game-state";
import {
  LAYOUT,
  isOnMountainStair,
  mountainGroundY,
  oldVillageGroundY,
  portGroundY,
  FARMLAND_TILES,
} from "./layout-maps";
import { showChoice, showDialogSequence } from "./dialogue";
import { setTimePauseSource } from "./time-pause";
import { npcs, npcGroup } from "./npc-runtime";
import { prologueRefs } from "./scene-registries";
import { groundY, updateCameraFrustum } from "./scene-sky";
import {
  isCameraShotsPlaying,
  isCameraAdjustModeActive,
  playCameraShots,
  stopCameraShots,
} from "./cutscene-camera";
import { animateWalk } from "./humanoid";
import { getScheduleTarget } from "./npc-defs";
import { SAVE_SLOT_COUNT } from "./save-slot-config";
import {
  completeStoryEvent,
  hasCompletedStoryEvent,
} from "./story/story-state";
import { setPresentationCamera } from "./first-person-camera";
import {
  PROLOGUE_MARKERS,
  PROLOGUE_OPENING_CAMERA_SHOTS,
  PROLOGUE_SCRIPT,
} from "./story/chapters/prologue-script";

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

// 多格存檔上線後，這裡要檢查 slot1..slot10 任一格是否存在。
// 不再只看單一 "default" key。故意不 import input-save.ts——那個檔案
// 已經 import 這個檔案的
// previewPrologue()，反過來 import 會形成循環 import(這個專案踩過的坑，
// 見 scene-sky.ts 開頭那段說明)；格數改讀無 DOM 副作用的純設定模組。
// "default" 這個舊 key 理論上開局時 title-screen.ts 的
// migrateLegacyDefaultSave() 就已經搬進 slot1、刪掉了，這裡多檢查一次
// 純粹是防守——萬一哪次搬家漏跑，也不會把有存檔的玩家誤判成新玩家、
// 重新逼一次序幕。
const SAVE_KEY_PREFIX = "meadowtide.save.";

export function shouldPlayPrologueOnBoot(): boolean {
  try {
    if (localStorage.getItem(SAVE_KEY_PREFIX + "default") !== null) {
      return false;
    }
    if (localStorage.getItem(SAVE_KEY_PREFIX + "autosave") !== null) {
      return false;
    }
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      if (localStorage.getItem(SAVE_KEY_PREFIX + "slot" + i) !== null) {
        return false;
      }
    }
    return true;
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
  | "guidedWalking"
  | "mapTransition"
  | "farmScan"
  | "farmingFree"
  | "seekingRod"
  | "fishingDialogue"
  | "done";

type PrologueMapLoader = (
  mapName: string,
  startPos: { x: number; z: number },
  onLoaded?: () => void | false,
) => void;

let stage: Stage = "inactive";
let stageProgress = 0; // 0~1，每個計時型階段自己歸零重算
let waypoints: THREE.Vector3[] = [];
let waypointIndex = 0;
let captainWaypointIndex = 0;
let captainWaypoints: THREE.Vector3[] = [];
let greetingDialogueStarted = false; // 防止 greeting 階段每幀重複呼叫 showDialogSequence
let hasTouchedDock = false; // 「腳踏上碼頭」的一次性判定，見 walking 階段
let prologueMapLoader: PrologueMapLoader | null = null;
let guideWaypoints: THREE.Vector3[] = [];
let guideWaypointIndex = 0;
let guideTrail: THREE.Vector3[] = [];
let guideOnComplete: (() => void) | null = null;
let useGuideZoom = false;
const TUTORIAL_PLOT = { minX: 13, maxX: 15, minZ: 22, maxZ: 24 } as const;

function tutorialCropCount() {
  let count = 0;
  for (let x = TUTORIAL_PLOT.minX; x <= TUTORIAL_PLOT.maxX; x++) {
    for (let z = TUTORIAL_PLOT.minZ; z <= TUTORIAL_PLOT.maxZ; z++) {
      if (cropState[`${x},${z}`]) count++;
    }
  }
  return count;
}

function prepareAbandonedFarm() {
  WOOD_NODES.length = 0;
  STONE_NODES.length = 0;
  FARMLAND_TILES.forEach(([x, z]) => {
    if (
      x >= TUTORIAL_PLOT.minX && x <= TUTORIAL_PLOT.maxX &&
      z >= TUTORIAL_PLOT.minZ && z <= TUTORIAL_PLOT.maxZ
    ) return;
    // Coordinate-seeded noise keeps the field stable without a checkerboard pattern.
    const scatter = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    const kind = scatter - Math.floor(scatter) < 0.5 ? "wood" : "stone";
    (kind === "wood" ? WOOD_NODES : STONE_NODES).push({
      id: `prologue-farm-${kind}-${x}-${z}`,
      kind,
      map: "livingArea",
      zone: "mountainSide",
      x,
      z,
      collected: false,
    });
  });
}

function resetPrologueStartingItems() {
  Object.keys(inventory.tools).forEach((toolId) => {
    inventory.tools[toolId] = false;
  });
  inventory.seeds = 0;
  inventory.potatoSeeds = 0;
  inventory.tomatoSeeds = 0;
  inventory.heldItemId = null;
  inventory.harvested = 0;
  inventory.fish = 0;
  inventory.wood = 0;
  inventory.stone = 0;
  inventory.oysters = 0;
  inventory.copper = 0;
  inventory.silver = 0;
  inventory.gold = 0;
  inventory.starCrystal = 0;
  inventory.godCrystal = 0;
  Object.keys(inventory.fishByTier).forEach((key) => {
    inventory.fishByTier[key] = 0;
  });
  Object.keys(inventory.pearls).forEach((key) => {
    inventory.pearls[key as keyof typeof inventory.pearls] = 0;
  });
  Object.keys(inventory.animalProducts).forEach((key) => {
    inventory.animalProducts[key as keyof typeof inventory.animalProducts] = 0;
  });
  inventory.dishes = {};
  inventory.storage = {};
  Object.keys(cropState).forEach((key) => delete cropState[key]);
}
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
let flyerPaper: THREE.Group | null = null;
let flyerPoseWeight = 0;
let flyerPoseAnimation = 0;
let flyerPoseStart = 0;
let flyerPoseFrom = 0;
let flyerPoseTo = 0;
let flyerPoseDuration = 1;
// 序幕演出用的固定鏡頭縮放——見 startPrologueScene() 內的設定。
const PROLOGUE_ZOOM = 5;
const PROLOGUE_GUIDE_ZOOM = 12;
const PROLOGUE_MAYOR_X = 3;
const PROLOGUE_MAYOR_Z = 22;
export const PROLOGUE_CAPTAIN_X = 5;
export const PROLOGUE_CAPTAIN_Z = 21;
const PROLOGUE_HOUR = 10;
const PROLOGUE_PHASE = PROLOGUE_HOUR / 24;
const FREE_TIME_PHASE = 15 / 24;
const PROLOGUE_FADE_SECONDS = 1;

function lockPrologueDateTime() {
  gameState.elapsed = dayLength * PROLOGUE_PHASE;
  gameState.currentDay = 0;
  gameState.currentPhase = PROLOGUE_PHASE;
  gameState.currentSeason = 0;
}

function lockPrologueZoom() {
  const targetZoom = useGuideZoom ? PROLOGUE_GUIDE_ZOOM : PROLOGUE_ZOOM;
  if (gameState.zoom === targetZoom) return;
  gameState.zoom = targetZoom;
  updateCameraFrustum();
}

function placePrologueMayor() {
  const mayor = npcs.find((npc) => npc.id === "mayor");
  if (!mayor) return;
  mayor.mesh.visible = true;
  mayor.mesh.position.set(
    PROLOGUE_MAYOR_X,
    LAYOUT.port.elevation,
    PROLOGUE_MAYOR_Z,
  );
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
const GUIDE_FOLLOW_DISTANCE = 0.72;
const GUIDE_FOLLOW_SPEED = WALK_SPEED * 1.25;

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
  const delta =
    ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + delta * t;
}

function faceDirection(dx: number, dz: number) {
  // 跟 game-loop.ts 主移動邏輯同一條公式：模型鼻子朝本地 -Z，所以要多轉
  // 半圈，見那邊「臉會永遠朝向來時路」的註解。
  if (dx === 0 && dz === 0) return;
  gameState.player.rotation.y = Math.atan2(dx, dz) + Math.PI;
}

function faceMayor(dx: number, dz: number) {
  const mayor = npcs.find((npc) => npc.id === "mayor");
  if (!mayor || (dx === 0 && dz === 0)) return;
  mayor.mesh.rotation.y = Math.atan2(-dx, -dz);
}

function faceBoth(dx: number, dz: number) {
  faceDirection(dx, dz);
  faceMayor(dx, dz);
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
  if (flyerPoseWeight > 0 && gameState.player.parts) {
    // animateRun() 在這之前會把手臂往待機角度拉回；事件姿勢必須最後套用。
    gameState.player.parts.armL.rotation.x = 1.18 * flyerPoseWeight;
    gameState.player.parts.armL.rotation.z = -0.2 * flyerPoseWeight;
    gameState.player.parts.armR.rotation.x = 1.24 * flyerPoseWeight;
    gameState.player.parts.armR.rotation.z = 0.16 * flyerPoseWeight;
  }
}

function animateFlyerPose(to: number, duration: number, done?: () => void) {
  flyerPoseAnimation++;
  const animationId = flyerPoseAnimation;
  flyerPoseStart = performance.now();
  flyerPoseFrom = flyerPoseWeight;
  flyerPoseTo = to;
  flyerPoseDuration = Math.max(0.01, duration);
  const tick = (now: number) => {
    if (animationId !== flyerPoseAnimation) return;
    const t = Math.min(1, (now - flyerPoseStart) / (flyerPoseDuration * 1000));
    const eased = 1 - Math.pow(1 - t, 3);
    flyerPoseWeight = THREE.MathUtils.lerp(flyerPoseFrom, flyerPoseTo, eased);
    if (t < 1) requestAnimationFrame(tick);
    else done?.();
  };
  requestAnimationFrame(tick);
}

function showFlyerPaper() {
  const arm = gameState.player?.parts?.armR as THREE.Group | undefined;
  if (!arm) return;
  if (!flyerPaper) {
    flyerPaper = new THREE.Group();
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.25, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xf1e3bf, roughness: 0.95 }),
    );
    flyerPaper.add(sheet);
    const ink = new THREE.MeshBasicMaterial({ color: 0x75664f });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.23 - i * 0.025, 0.012, 0.006),
        ink,
      );
      line.position.set(-0.025, 0.065 - i * 0.045, -0.009);
      flyerPaper.add(line);
    }
  }
  arm.add(flyerPaper);
  flyerPaper.position.set(-0.11, -0.39, -0.2);
  flyerPaper.rotation.set(-0.15, 0.08, -0.08);
  flyerPaper.visible = true;
  animateFlyerPose(1, 0.45);
}

function hideFlyerPaper() {
  animateFlyerPose(0, 0.35, () => {
    if (flyerPaper?.parent) flyerPaper.parent.remove(flyerPaper);
    if (flyerPaper) flyerPaper.visible = false;
  });
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
    new THREE.Vector3(
      PROLOGUE_CAPTAIN_X,
      LAYOUT.port.elevation,
      PROLOGUE_CAPTAIN_Z,
    ),
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

function guideGroundY(mapName: string, x: number, z: number): number {
  // Interior floors are built at Y=0. Falling through to living-area groundY()
  // re-applies the outdoor plateau height after loadMap positioned the player.
  if (mapName === "house") return 0;
  if (mapName === "port") return portGroundY(x, z);
  if (mapName === "oldVillage") return oldVillageGroundY(x, z) + 0.03;
  if (mapName === "mountain")
    return mountainGroundY(x, z) + (isOnMountainStair(x, z) ? 0.3 : 0.08);
  return groundY(x, z);
}

function placeGuideActor(actor: any, x: number, z: number) {
  const gy = guideGroundY(gameState.currentMapName, x, z);
  actor.mesh.position.set(x, gy, z);
  actor.mesh.visible = true;
  actor.path = null;
  actor.pathIndex = 0;
  actor.lastTargetKey = null;
  animateWalk(actor.mesh, false, gameState.effectElapsed);
  actor.mesh.position.y = gy;
}

function startGuidedWalk(
  points: { x: number; z: number }[],
  onComplete: () => void,
) {
  const mayor = npcs.find((npc) => npc.id === "mayor");
  if (!mayor || points.length < 2) {
    onComplete();
    return;
  }
  placeGuideActor(mayor, points[0].x, points[0].z);
  guideWaypoints = points.map(
    ({ x, z }) =>
      new THREE.Vector3(x, guideGroundY(gameState.currentMapName, x, z), z),
  );
  guideWaypointIndex = 1;
  guideTrail = [mayor.mesh.position.clone()];
  guideOnComplete = onComplete;
  useGuideZoom = true;
  lockPrologueZoom();
  beginStage("guidedWalking");
}

function transitionPrologueMap(
  mapName: string,
  playerPosition: { x: number; z: number },
  mayorPosition: { x: number; z: number },
  onLoaded: () => void,
) {
  if (!prologueMapLoader) {
    console.warn("[序幕] 尚未接入 loadMap，無法繼續跨地圖導覽。");
    useGuideZoom = false;
    beginStage("done");
    gameState.cutsceneActive = false;
    return;
  }
  beginStage("mapTransition");
  prologueMapLoader(mapName, playerPosition, () => {
    const mayor = npcs.find((npc) => npc.id === "mayor");
    if (mayor) {
      // buildMap hides the shared NPC parent outside normal outdoor schedules.
      // A visible story actor under that hidden parent would still not render.
      npcGroup.visible = true;
      placeGuideActor(mayor, mayorPosition.x, mayorPosition.z);
      mayor.mesh.rotation.y = 0;
    }
    gameState.player.position.x = playerPosition.x;
    gameState.player.position.z = playerPosition.z;
    gameState.player.position.y = guideGroundY(
      mapName,
      playerPosition.x,
      playerPosition.z,
    );
    gameState.playerGridPos = { ...playerPosition };
    gameState.player.rotation.y = 0;
    syncLastPlayerY();
    lockPrologueZoom();
    onLoaded();
  });
}

let farmScanProgress = 0;
let farmScanOnComplete: (() => void) | null = null;
const FARM_SCAN_LEG_DURATION = 3; // 每轉 90 度 1.35 秒
const FARM_SCAN_TOTAL_DURATION = FARM_SCAN_LEG_DURATION * 4; // 4 段合計 5.4 秒

function startFarmScan(onComplete: () => void) {
  farmScanOnComplete = onComplete;
  farmScanProgress = 0;
  beginStage("farmScan");
  gameState.player.visible = false;
  // 初始第一人稱視角：朝正北 (yaw = 0)
  setPresentationCamera({
    positionX: gameState.player.position.x,
    positionY: gameState.player.position.y + 0.82,
    positionZ: gameState.player.position.z,
    yaw: 0,
    pitch: 0,
    fov: 65,
  });
}

function scriptMarkerIndex(lines: any[], marker: string) {
  const index = lines.findIndex((line) => line === marker);
  if (index < 0) throw new Error(`[序幕] 找不到腳本標記：${marker}`);
  return index;
}

function finishPrologue() {
  const captain = npcs.find((npc) => npc.id === "captain");
  if (captain) {
    captain.mesh.position.set(PROLOGUE_CAPTAIN_X, LAYOUT.port.elevation, PROLOGUE_CAPTAIN_Z);
    captain.mesh.rotation.y = Math.PI;
    const scheduleTarget = getScheduleTarget(captain.schedule, gameState.currentPhase);
    captain.lastTargetKey = scheduleTarget.x + "," + scheduleTarget.z;
    captain.path = [];
    captain.pathIndex = 0;
  }
  beginStage("done");
  completeStoryEvent("main.prologue.arrival");
  gameState.cutsceneActive = false;
  setTimePauseSource("event", false);
  gameState.elapsed = dayLength * FREE_TIME_PHASE;
  gameState.currentPhase = FREE_TIME_PHASE;
}

let fishingSequenceStarted = false;

export function isPrologueSeekingRod(): boolean {
  return stage === "seekingRod";
}

export function startPrologueFishingSequence() {
  if (stage !== "seekingRod" || fishingSequenceStarted) return;
  fishingSequenceStarted = true;
  beginStage("fishingDialogue");
  gameState.cutsceneActive = true;
  lockPrologueDateTime();
  const captain = npcs.find((npc) => npc.id === "captain");
  const mayor = npcs.find((npc) => npc.id === "mayor");
  if (captain) {
    captain.mesh.visible = true;
    captain.mesh.position.set(
      PROLOGUE_CAPTAIN_X,
      LAYOUT.port.elevation,
      PROLOGUE_CAPTAIN_Z,
    );
    captain.mesh.rotation.y = Math.PI;
  }
  if (mayor) {
    mayor.mesh.visible = true;
    mayor.mesh.position.set(
      PROLOGUE_CAPTAIN_X - 1.2,
      LAYOUT.port.elevation,
      PROLOGUE_CAPTAIN_Z + 1,
    );
    mayor.mesh.rotation.y = -Math.PI / 4;
  }
  faceDirection(
    PROLOGUE_CAPTAIN_X - gameState.player.position.x,
    PROLOGUE_CAPTAIN_Z - gameState.player.position.z,
  );
  showDialogSequence(PROLOGUE_SCRIPT.fishing, () => {
    inventory.tools.fishingRod = true;
    showDialogSequence(PROLOGUE_SCRIPT.cooking, () => {
      finishPrologue();
    });
  });
}

function showHouseSequence() {
  const choiceIndex = scriptMarkerIndex(
    PROLOGUE_SCRIPT.house,
    PROLOGUE_MARKERS.foodQuestion,
  );
  showDialogSequence(PROLOGUE_SCRIPT.house.slice(1, choiceIndex), () => {
    showChoice(
      "「還有什麼想問的嗎？」",
      [{ label: "在蘿蔔成熟以前，我要吃什麼？", value: "food" }],
      () => {
        inventory.fish += 3;
        inventory.harvested += 6;
        showDialogSequence(
          PROLOGUE_SCRIPT.house.slice(choiceIndex + 1),
          () => {
            beginStage("seekingRod");
            gameState.cutsceneActive = false;
            useGuideZoom = false;
            lockPrologueZoom();
            lockPrologueDateTime();
          },
        );
      },
    );
  });
}

function walkToFarmHouse() {
  startGuidedWalk(
    [
      { x: 26, z: 20 },
      { x: 21, z: 20 },
      { x: 21, z: 16 },
    ],
    () =>
      transitionPrologueMap(
        "house",
        { x: 8, z: 12 },
        { x: 7, z: 12 },
        showHouseSequence,
      ),
  );
}

function showRestAreaSequence() {
  const secondWalk = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.walkRestArea,
  );
  showDialogSequence(PROLOGUE_SCRIPT.farming.slice(secondWalk + 1), walkToFarmHouse);
}

function walkToRestArea() {
  startGuidedWalk(
    [
      { x: 21, z: 5 },
      { x: 26, z: 5 },
      { x: 26, z: 20 },
    ],
    () => {
      faceBoth(0, 1);
      showRestAreaSequence();
    },
  );
}

function showAnimalBarnSequence() {
  const firstWalk = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.walkIrrigation,
  );
  const secondWalk = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.walkRestArea,
  );
  showDialogSequence(
    PROLOGUE_SCRIPT.farming.slice(firstWalk + 1, secondWalk),
    walkToRestArea,
  );
}

function walkAlongIrrigationChannel() {
  startGuidedWalk(
    [
      { x: 14, z: 20 },
      { x: 14, z: 14 },
      { x: 17, z: 14 },
      { x: 17, z: 5 },
      { x: 21, z: 5 },
    ],
    () => {
      faceBoth(0, -1);
      showAnimalBarnSequence();
    },
  );
}

function continueAfterPlanting() {
  const plantedMarker = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.farmingComplete,
  );
  const firstWalk = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.walkIrrigation,
  );
  showDialogSequence(
    PROLOGUE_SCRIPT.farming.slice(plantedMarker + 1, firstWalk),
    walkAlongIrrigationChannel,
  );
}

function beginFreePlanting() {
  beginStage("farmingFree");
  gameState.cutsceneActive = false;
  lockPrologueDateTime();
}

function startFarmingTutorial() {
  const plantedMarker = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.farmingComplete,
  );
  const lookMarker = scriptMarkerIndex(
    PROLOGUE_SCRIPT.farming,
    PROLOGUE_MARKERS.lookAtAbandonedFarm,
  );
  for (let x = TUTORIAL_PLOT.minX; x <= TUTORIAL_PLOT.maxX; x++) {
    for (let z = TUTORIAL_PLOT.minZ; z <= TUTORIAL_PLOT.maxZ; z++) {
      delete cropState[`${x},${z}`];
    }
  }
  inventory.seeds = 9;
  inventory.heldItemId = null;
  faceMayor(1, 0);
  showDialogSequence(PROLOGUE_SCRIPT.farming.slice(0, lookMarker), () => {
    faceDirection(0, 1);
    showDialogSequence([PROLOGUE_SCRIPT.farming[lookMarker]], () => {
      faceMayor(0, 1);
      showDialogSequence(
        PROLOGUE_SCRIPT.farming.slice(lookMarker + 1, plantedMarker),
        beginFreePlanting,
      );
    });
  });
}

function finishPrologueTour() {
  useGuideZoom = false;
  lockPrologueZoom();
  showDialogSequence(PROLOGUE_SCRIPT.tour.slice(9), () => {
    startGuidedWalk(
      [
        { x: 21, z: 20 },
        { x: 14, z: 20 },
      ],
      startFarmingTutorial,
    );
  });
}

function startLivingAreaArrival() {
  useGuideZoom = false;
  lockPrologueZoom();
  showDialogSequence([PROLOGUE_SCRIPT.tour[8]], () => {
    startFarmScan(() => {
      startGuidedWalk(
        [
          LAYOUT.livingArea.prologueArrival.mayor,
          { x: 21, z: 20 },
        ],
        finishPrologueTour,
      );
    });
  });
}

function startVillageToFarmGuide() {
  startGuidedWalk(
    [
      LAYOUT.oldVillage.prologueGuide.arrival,
      LAYOUT.oldVillage.prologueGuide.corner,
      LAYOUT.oldVillage.prologueGuide.exit,
    ],
    () => {
      prepareAbandonedFarm();
      transitionPrologueMap(
        "livingArea",
        LAYOUT.livingArea.prologueArrival.player,
        LAYOUT.livingArea.prologueArrival.mayor,
        startLivingAreaArrival,
      );
    },
  );
}

function showVillagePlazaDialogue() {
  showDialogSequence(PROLOGUE_SCRIPT.tour.slice(5, 8), startVillageToFarmGuide);
}

function startPortToVillageGuide() {
  startGuidedWalk(
    [LAYOUT.port.prologueGuide.start, LAYOUT.port.prologueGuide.exit],
    () =>
      transitionPrologueMap(
        "oldVillage",
        LAYOUT.oldVillage.prologueGuide.arrival,
        LAYOUT.oldVillage.prologueGuide.arrival,
        showVillagePlazaDialogue,
      ),
  );
}

function startWelcomeDialogue() {
  const mayor = npcs.find((n) => n.id === "mayor");
  const captain = npcs.find((n) => n.id === "captain");
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
  showDialogSequence(PROLOGUE_SCRIPT.tour.slice(0, 4), startPortToVillageGuide);
}

function startShipDialogue() {
  showFlyerPaper();
  // 這顆鏡頭從傳單出現一路保持到船長說完「東西收一收吧」。duration
  // 只表示補間時間；最後的 true 讓鏡頭到位後持續接管，直到對話完成時
  // 明確 stop，避免 1.5 秒後在台詞中途跳回自動跟隨。
  playCameraShots(
    PROLOGUE_OPENING_CAMERA_SHOTS,
    gameState.player.position.x,
    gameState.player.position.z,
    gameState.zoom,
    undefined,
    0,
    Math.PI / 2 - Math.PI / 4,
    true,
  );
  showDialogSequence(PROLOGUE_SCRIPT.flyer, () => {
    hideFlyerPaper();
    stopCameraShots();
    beginStage("approaching");
  });
}

export function startPrologueScene(
  opts: {
    force?: boolean;
    alreadyFaded?: boolean;
    loadMap?: PrologueMapLoader;
  } = {},
) {
  if (opts.loadMap) prologueMapLoader = opts.loadMap;
  if (!opts.force && stage !== "inactive" && stage !== "done") return;
  fishingSequenceStarted = false;
  if (!prologueRefs.ferry || !prologueRefs.gangplank) {
    console.warn(
      "[序幕] prologueRefs 還沒填好(需要先進過一次港口地圖)，跳過演出。",
    );
    return;
  }
  if (!opts.force) resetPrologueStartingItems();
  const fadeEl = document.getElementById("fade") as HTMLElement;
  // 序章開場比一般換圖慢：先用一秒淡到黑，完成船／角色定位後再用一秒
  // 淡入第一顆鏡頭。只覆寫這次序章，淡入完成後恢復 style.css 的全域值。
  fadeEl.style.transition = `opacity ${PROLOGUE_FADE_SECONDS}s ease`;
  gameState.cutsceneActive = true;
  lockPrologueDateTime();
  lockPrologueZoom();
  fadeEl.style.opacity = "1";
  setTimeout(
    () => {
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
      setTimeout(() => {
        fadeEl.style.transition = "";
        startShipDialogue();
      }, PROLOGUE_FADE_SECONDS * 1000);
    },
    opts.alreadyFaded ? 0 : PROLOGUE_FADE_SECONDS * 1000,
  );
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
export function isPrologueFarmingActive(): boolean {
  return stage === "farmingFree";
}

export function updatePrologueGameplayGate() {
  if (stage !== "farmingFree" && stage !== "seekingRod") return;
  lockPrologueDateTime();
  if (stage === "seekingRod" || tutorialCropCount() < 9) return;
  inventory.seeds = 0;
  if (inventory.heldItemId === "radishSeeds") inventory.heldItemId = null;
  beginStage("mapTransition");
  gameState.cutsceneActive = true;
  setTimePauseSource("event", false);
  const fadeEl = document.getElementById("fade") as HTMLElement;
  fadeEl.style.opacity = "1";
  window.setTimeout(() => {
    const mayor = npcs.find((npc) => npc.id === "mayor");
    gameState.player.position.x = 13;
    gameState.player.position.z = 20;
    gameState.player.position.y = guideGroundY("livingArea", 13, 20);
    gameState.playerGridPos = { x: 13, z: 20 };
    if (mayor) placeGuideActor(mayor, 14, 20);
    faceDirection(1, 0);
    faceMayor(-1, 0);
    syncLastPlayerY();
    fadeEl.style.opacity = "0";
    window.setTimeout(continueAfterPlanting, 450);
  }, 450);
}
export function isPrologueShipStage(): boolean {
  return (
    stage === "atSea" || stage === "approaching" || stage === "rampLowering"
  );
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

  if (stage === "guidedWalking") {
    const mayor = npcs.find((npc) => npc.id === "mayor");
    if (!mayor) {
      const onComplete = guideOnComplete;
      guideOnComplete = null;
      onComplete?.();
      return;
    }

    const target = guideWaypoints[guideWaypointIndex];
    let mayorMoving = false;
    if (target) {
      const dx = target.x - mayor.mesh.position.x;
      const dz = target.z - mayor.mesh.position.z;
      const distance = Math.hypot(dx, dz);
      const stepDistance = WALK_SPEED * dt;
      if (distance <= Math.max(stepDistance, 0.03)) {
        mayor.mesh.position.x = target.x;
        mayor.mesh.position.z = target.z;
        guideWaypointIndex++;
      } else {
        const nx = dx / distance;
        const nz = dz / distance;
        mayor.mesh.position.x += nx * stepDistance;
        mayor.mesh.position.z += nz * stepDistance;
        mayor.mesh.rotation.y = Math.atan2(-nx, -nz);
        mayorMoving = true;
      }
      const lastTrailPoint = guideTrail[guideTrail.length - 1];
      if (
        !lastTrailPoint ||
        Math.hypot(
          mayor.mesh.position.x - lastTrailPoint.x,
          mayor.mesh.position.z - lastTrailPoint.z,
        ) >= 0.12
      )
        guideTrail.push(mayor.mesh.position.clone());
    }

    const leaderDistance = Math.hypot(
      mayor.mesh.position.x - gameState.player.position.x,
      mayor.mesh.position.z - gameState.player.position.z,
    );
    let playerMoving = false;
    while (guideTrail.length) {
      const reached = guideTrail[0];
      if (
        Math.hypot(
          reached.x - gameState.player.position.x,
          reached.z - gameState.player.position.z,
        ) > 0.1
      )
        break;
      guideTrail.shift();
    }
    if (guideTrail.length && leaderDistance > GUIDE_FOLLOW_DISTANCE) {
      const playerTarget = guideTrail[0];
      const dx = playerTarget.x - gameState.player.position.x;
      const dz = playerTarget.z - gameState.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0) {
        const stepDistance = Math.min(distance, GUIDE_FOLLOW_SPEED * dt);
        const nx = dx / distance;
        const nz = dz / distance;
        gameState.player.position.x += nx * stepDistance;
        gameState.player.position.z += nz * stepDistance;
        faceDirection(nx, nz);
        playerMoving = true;
      }
    }

    const mayorGround = guideGroundY(
      gameState.currentMapName,
      mayor.mesh.position.x,
      mayor.mesh.position.z,
    );
    animateWalk(mayor.mesh, mayorMoving, gameState.effectElapsed);
    mayor.mesh.position.y += mayorGround;
    gameState.player.position.y = guideGroundY(
      gameState.currentMapName,
      gameState.player.position.x,
      gameState.player.position.z,
    );
    gameState.playerGridPos = {
      x: Math.round(gameState.player.position.x),
      z: Math.round(gameState.player.position.z),
    };
    gameState.isMoving = playerMoving;
    syncLastPlayerY();

    if (
      guideWaypointIndex >= guideWaypoints.length &&
      Math.hypot(
        mayor.mesh.position.x - gameState.player.position.x,
        mayor.mesh.position.z - gameState.player.position.z,
      ) <=
        GUIDE_FOLLOW_DISTANCE + 0.18
    ) {
      gameState.isMoving = false;
      const onComplete = guideOnComplete;
      guideOnComplete = null;
      guideWaypoints = [];
      guideTrail = [];
      onComplete?.();
    }
    return;
  }

  if (stage === "mapTransition") {
    gameState.isMoving = false;
    return;
  }
  if (stage === "fishingDialogue") {
    gameState.isMoving = false;
    return;
  }

  if (stage === "farmScan") {
    gameState.isMoving = false;
    farmScanProgress = Math.min(
      1,
      farmScanProgress + dt / FARM_SCAN_TOTAL_DURATION,
    );
    const totalT = farmScanProgress * 4; // 0 ~ 4 代表 4 個 90 度轉向階段
    const leg = Math.min(3, Math.floor(totalT));
    const legT = totalT - leg; // 各階段內 0 ~ 1
    // 平滑加減速 (easeInOut)
    const eased = 0.5 - 0.5 * Math.cos(legT * Math.PI);

    let currentYaw = 0;
    if (leg === 0) {
      // 0 -> 慢慢往左轉 90 度 (+PI / 2)
      currentYaw = (Math.PI / 2) * eased;
    } else if (leg === 1) {
      // +PI / 2 -> 回到中間 (0)
      currentYaw = (Math.PI / 2) * (1 - eased);
    } else if (leg === 2) {
      // 0 -> 再往右轉 90 度 (-PI / 2)
      currentYaw = -(Math.PI / 2) * eased;
    } else {
      // -PI / 2 -> 往左轉 90 度回到原本狀態 (0)
      currentYaw = -(Math.PI / 2) * (1 - eased);
    }

    setPresentationCamera({
      positionX: gameState.player.position.x,
      positionY: gameState.player.position.y + 0.82,
      positionZ: gameState.player.position.z,
      yaw: currentYaw,
      pitch: 0,
      fov: 65,
    });

    if (farmScanProgress >= 1) {
      setPresentationCamera(null);
      gameState.player.visible = true;
      beginStage("inactive");
      const cb = farmScanOnComplete;
      farmScanOnComplete = null;
      cb?.();
    }
    return;
  }

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
        captain.mesh.position.y,
        target.y,
        Math.min(1, step / dist),
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
