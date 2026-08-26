import * as THREE from "three";
import { gameState } from "./game-state";
import { LAYOUT } from "./layout-maps";
import { showDialogSequence } from "./dialogue";
import { npcs, npcGroup } from "./npc-runtime";
import { prologueRefs } from "./scene-registries";
import { updateCameraFrustum } from "./scene-sky";

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

type Stage =
  | "inactive"
  | "atSea"
  | "approaching"
  | "rampLowering"
  | "walking"
  | "greeting"
  | "done";

let stage: Stage = "inactive";
let stageProgress = 0; // 0~1，每個計時型階段自己歸零重算
let waypoints: THREE.Vector3[] = [];
let waypointIndex = 0;
let greetingDialogueStarted = false; // 防止 greeting 階段每幀重複呼叫 showDialogSequence
let hasTouchedDock = false; // 「腳踏上碼頭」的一次性判定，見 walking 階段
// 序幕演出用的固定鏡頭縮放——見 startPrologueScene() 內的設定。
const PROLOGUE_ZOOM = 5;

// 演出參數——先求「有動作、順序對」，實際格數/秒數之後看畫面再調，
// 都寫成具名常數方便找。
// 2026-08-26 Zeppelin 反饋「船開頭再往右20格」——原本 18 再加 20，
// 外海起始點推得更遠，鏡頭鎖在船上時比較看得出「船正在從遠處開過來」
// 的距離感，不是一開始就幾乎貼著碼頭。
const SEA_OFFSET_X = 38; // 演出開場時，船比停靠位再往外海(世界 +X)推幾格
const APPROACH_SECONDS = 4.5; // 船從外海滑回停靠位的時間
const RAMP_LOWER_SECONDS = 1.4;
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
  const world = ferry.localToWorld(localPoint.clone());
  world.z = LAYOUT.port.ferry.z;
  return world;
}

function faceDirection(dx: number, dz: number) {
  // 跟 game-loop.ts 主移動邏輯同一條公式：模型鼻子朝本地 -Z，所以要多轉
  // 半圈，見那邊「臉會永遠朝向來時路」的註解。
  if (dx === 0 && dz === 0) return;
  gameState.player.rotation.y = Math.atan2(dx, dz) + Math.PI;
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
  waypointIndex = 0;
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
    captain.mesh.position.set(dockRamp.x - 0.3, dockRamp.y, dockRamp.z + 1);
  }
  if (mayor) {
    // 村長平常掛在生活區，這場戲直接把她搬到港口——跟木匠事件的
    // startCarpenterDockScene() 是同一招(mayor.mesh.position.set 覆蓋
    // 掉她原本的行程表座標)，演出結束後她會照正常排程走，不用另外復原。
    mayor.mesh.visible = true;
    mayor.mesh.position.set(
      dockRamp.x - 2.4,
      LAYOUT.port.elevation,
      dockRamp.z - 1.2,
    );
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
  fadeEl.style.opacity = "1";
  setTimeout(() => {
    const ferry = prologueRefs.ferry!;
    ferry.position.x = prologueRefs.ferryRestX + SEA_OFFSET_X;
    // 跳板：不是隱藏、是「收合貼在船頭」，一路跟著船——見
    // syncGangplankToBow() 的註解。
    prologueRefs.gangplank!.visible = true;
    syncGangplankToBow();
    npcGroup.visible = true;
    const captain = npcs.find((n) => n.id === "captain");
    if (captain) captain.mesh.visible = false; // 開船中，先不現身，靠岸繫繩時才出場
    const mayor = npcs.find((n) => n.id === "mayor");
    if (mayor) mayor.mesh.visible = false;
    gameState.player.position.copy(bowWorldPoint(PLAYER_BOW_LOCAL));
    gameState.player.visible = true;
    gameState.isMoving = false;
    // 面向碼頭方向(世界 -X)，像在等船靠岸。
    faceDirection(LAYOUT.port.basin.x - LAYOUT.port.ferry.x, 0);
    // 2026-08-26 Zeppelin 反饋「先鎖定事件預設zoom5，演出有需要調整時
    // 我會講」——開演出時直接把鏡頭縮放釘死在這個值，不管玩家(或上次
    // 除錯時)手動滾輪滾到哪個縮放，都從同一個已知距離開始。
    gameState.zoom = PROLOGUE_ZOOM;
    updateCameraFrustum();
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
  const ferry = prologueRefs.ferry;
  const gangplank = prologueRefs.gangplank;
  if (!ferry || !gangplank) return;

  if (stage === "atSea") {
    // 對話還開著，船跟人都定住不動，位置在 startPrologueScene() 已經
    // 設好，這裡不用再動——單純等 startShipDialogue() 的 onComplete
    // 把 stage 推進到 approaching。
    gameState.player.position.y = bowWorldPoint(PLAYER_BOW_LOCAL).y;
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
    gangplank.rotation.z = THREE.MathUtils.lerp(
      RAMP_RAISED_ROTATION_Z,
      restAngleFromBow,
      stageProgress,
    );
    gameState.player.position.copy(bowWorldPoint(PLAYER_BOW_LOCAL));
    if (stageProgress >= 1) {
      gangplank.position.copy(prologueRefs.gangplankRestPosition!);
      gangplank.rotation.z = prologueRefs.gangplankRestRotationZ;
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
      // waypoints[2] 是跳板碼頭端(rampBottom)——腳真正踏上碼頭的判定
      // 點，之後(dockGreet)才是純粹走位，不算「下船」這件事本身。
      if (waypointIndex === 2 && !hasTouchedDock) {
        hasTouchedDock = true;
        console.info("[序幕] 已踏上碼頭");
      }
      waypointIndex++;
      if (waypointIndex >= waypoints.length) beginStage("greeting");
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
      faceDirection(nx, nz);
    }
    gameState.isMoving = true;
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
