import {
  gameState,
  inventory,
  isNightTime,
  nearAnyNpc,
  TIME_CONFIG,
} from "./game-state";
import {
  chefQuest,
  CHEF_MEAL_THRESHOLD,
  CHEF_MEAL_WINDOW_START,
  CHEF_MEAL_WINDOW_END,
  LAYOUT,
} from "./layout-maps";
import { showDialog, showDialogSequence, dialogQueue } from "./dialogue";
import { npcs } from "./npc-runtime";

// ==============================================================
// 開發模式除錯覆寫：Vite 的 HMR 只有模組自己呼叫 import.meta.hot.accept()
// 才會做局部熱替換，這個專案沒有任何模組這樣做（整個場景圖/DOM 副作用
// 沒辦法安全局部替換），所以幾乎每次存檔改動，Vite 都會直接觸發整頁重新
// 載入——不只 chefQuest，gameState/inventory/carpenterQuest 全部模組層級
// 狀態都會被重新初始化，這不是廚師事件專屬的問題，是這個開發模式下全專
// 案共通的行為。
// 這裡只先解決 chefQuest：用 Object.defineProperty 把它的欄位換成
// getter/setter，每次「透過主控台 __chefQuest.xxx = ...」寫入時同步存進
// localStorage；模組載入的當下（也就是每次整頁重新載入的當下）再從
// localStorage 讀回來蓋掉預設值。只在 import.meta.env.DEV 生效——
// production build（含匯出的 exe）這個 if 整塊會被靜態消掉，不會影響
// 正式遊戲，也不會佔用打包體積。
if (import.meta.env.DEV) {
  const DEBUG_STORAGE_KEY = "meadowtide.debug.chefQuest";
  try {
    const saved = localStorage.getItem(DEBUG_STORAGE_KEY);
    if (saved) Object.assign(chefQuest, JSON.parse(saved));
  } catch (err) {
    console.warn("[廚師] 讀取開發模式除錯覆寫值失敗，維持預設值", err);
  }
  const persist = () => {
    try {
      localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(chefQuest));
    } catch (err) {
      // 開發輔助功能而已，localStorage 寫入失敗不該讓遊戲掛掉
    }
  };
  (Object.keys(chefQuest) as (keyof typeof chefQuest)[]).forEach((key) => {
    let value: any = (chefQuest as any)[key];
    Object.defineProperty(chefQuest, key, {
      enumerable: true,
      configurable: true,
      get: () => value,
      set: (next) => {
        value = next;
        persist();
      },
    });
  });
}

export function hasEnoughSharedMeals() {
  return chefQuest.sharedMealCount >= CHEF_MEAL_THRESHOLD;
}

export function startChefDockScene() {
  chefQuest.stage = "arrived"; // 立刻推進，防止原地重複觸發
  showDialogSequence([
    {
      text: "「這次船上也有一個人要來——說是想在島上開間能吃飯、能過夜的地方。」",
      speaker: "aunt",
      name: "村長",
    },
    "[船靠岸，一位揹著大背包的女性走下船，先没看阿姨，反而先抬頭聞了聞風的味道]",
    { text: "「……海風裡有煙燻味。有人在曬魚乾？」", speaker: "chef" },
    {
      text: "「啊——對，是東邊那戶。你鼻子真靈。」",
      speaker: "aunt",
      name: "村長",
    },
    { text: "「（低頭看了看自己的背包）職業病。」", speaker: "chef" },
    { text: "「聽說村子裡有間空著的民宿？」", speaker: "chef" },
    {
      text: "「有，不過荒廢好一陣子了。要不要先去看看？」",
      speaker: "aunt",
      name: "村長",
    },
    { text: "「看看無妨。」", speaker: "chef" },
  ]);
}

export function handleChefDockTouch() {
  if (dialogQueue.length) return; // 對話播放中不要被重新觸發打斷
  if (chefQuest.stage === "not_started") startChefDockScene();
}

export function startChefHouseScene() {
  chefQuest.stage = "proving"; // 立刻推進，避免對話播放中重複觸發
  chefQuest.sharedMealCount = 0;
  chefQuest.lastMealDay = -1;
  showDialogSequence([
    "[她一路走一路打量，經過廚房位置時腳步停得最久]",
    {
      text: "「（蹲下看爐台）這個灶台還能用，煙道大概堵了。」",
      speaker: "chef",
    },
    "玩家：「這裡怎麼樣？」",
    { text: "「地方是好地方。」", speaker: "chef" },
    { text: "「但我不是來評估房子的。房子我隨時能修。」", speaker: "chef" },
    { text: "「我在看的是別的事。」", speaker: "chef" },
    {
      text: "「我以前待過的廚房，什麼都不缺，就是沒人真的『一起』吃飯——各吃各的，吃完就散。」",
      speaker: "chef",
    },
    {
      text: "「所以在我開火做第一頓飯之前，我想先看看：這裡的人，是不是真的會坐下來、一起吃一頓飯。」",
      speaker: "chef",
    },
    {
      text: "「不是我端菜給你們吃那種。是你們自己，真的會聚在一起。」",
      speaker: "chef",
    },
    { text: "「做給我看，我就留下來。」", speaker: "chef" },
  ]);
}

export function tryAdvanceChefCondition() {
  if (!hasEnoughSharedMeals()) {
    // 材料/次數不夠時 stage 保持 proving（不像木匠退回 en_route_village）：
    // 共餐要橫跨好幾天才會湊滿門檻，如果每次都退回去、下次敲門重播整段
    // 開場白，這幾天玩家會被同一段長對白煩到——只回一句簡短反應就好。
    showDialog({
      text:
        chefQuest.sharedMealCount > 0
          ? "「（抱著手臂靠在門框上）……有點意思，繼續。」"
          : "「（抱著手臂靠在門框上）還在看。」",
      speaker: "chef",
    });
    return;
  }
  chefQuest.stage = "renovating";
  chefQuest.renovatingStartDay = gameState.currentDay;
  showDialogSequence([
    { text: "「（沒等你開口）我看到了。」", speaker: "chef" },
    {
      text: "「不是什麼盛大的場面，就幾個人分著吃、有一句沒一句地聊——但那才是真的。」",
      speaker: "chef",
    },
    { text: "「行，這地方我要了。」", speaker: "chef" },
    { text: "「廚房交給我自己弄，你不用管。大概……兩天。」", speaker: "chef" },
    { text: "「兩天後，我會準備好第一頓飯。」", speaker: "chef" },
  ]);
}

export function startChefMoveInScene() {
  chefQuest.stage = "moved_in";
  showDialogSequence([
    "[窗戶第一次亮起燈，還飄著淡淡的油煙味，廚師站在門口，手上是剛擦乾的圍裙]",
    { text: "「進來吧，剛好夠一個人份。」", speaker: "ˊㄕ" },
    {
      // 跟木匠入住場景同一招：CG 圖檔還沒生成時 setDialogCg() 會 warn 一聲
      // 然後留在原本的 3D 畫面，不會卡住。
      text: "「這是我這輩子，第一次不是為了『客人』做飯。」",
      speaker: "chef",
      cg: "chef_movein",
    },
  ]);
  const chefNpc = npcs.find((n) => n.id === "chef");
  if (chefNpc) chefNpc.mesh.visible = true;
}

export function handleChefDoorstepTouch() {
  if (dialogQueue.length) return;
  if (chefQuest.stage === "arrived") {
    startChefHouseScene();
  } else if (chefQuest.stage === "proving") {
    tryAdvanceChefCondition();
  } else if (chefQuest.stage === "ready_for_move_in" && isNightTime()) {
    startChefMoveInScene();
  }
}

// 「共餐」判定：休息區、白天到傍晚的時段內(不限定哪一餐)、身上有收成或
// 漁獲、旁邊有其他 NPC 在場，四個條件同時成立時才算數，同一天只能算一次。
// 這是廚師招募條件專屬的判定，跟木匠的材料檢查是完全不同的機制——不是
// 天數延遲，是玩家行為累積次數，掛在 E 鍵互動裡呼叫，不是掛在
// beginNewDay() 的每日結算裡。
export function isInRestArea(x: number, z: number) {
  const area = LAYOUT.restArea;
  return (
    x >= area.x &&
    x < area.x + area.width &&
    z >= area.z &&
    z < area.z + area.height
  );
}

// 「一起吃飯」不用嚴格到公尺級的距離判定——只要生活區裡有任何一個已經
// 現身的 NPC（阿姨/入住後的木匠），就算大家共處在同一個生活空間裡，敘事
// 上足夠了。故意不比座標距離：省掉一整類「座標系統/門檻抓多少才對」可能
// 出錯的地方，呼叫端本來就只在 currentMapName==="livingArea" 時才會問這
// 個問題，不需要另外比對地圖名稱。
function isAnyNpcPresent() {
  return npcs.some((n) => n.mesh.visible);
}

function formatGameHour(hour: number) {
  const wrapped =
    ((hour % TIME_CONFIG.gameHoursPerDay) + TIME_CONFIG.gameHoursPerDay) %
    TIME_CONFIG.gameHoursPerDay;
  const hh = Math.floor(wrapped);
  const mm = Math.floor((wrapped - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// 純判斷，不呼叫 showDialogSequence、不動 inventory：回傳 null 代表玩家根本
// 不在休息區（不算「試著共餐」，呼叫端不用理會）；否則回傳每個條件現在
// 各自的判定結果，讓「單獨按 E 觸發」跟「跟閒聊台詞合併」兩條路徑共用
// 同一份檢查邏輯，不用各寫一次、以後容易兜不齊。
function evaluateChefMealConditions() {
  if (!gameState.player) return null;
  const inRestArea = isInRestArea(
    gameState.player.position.x,
    gameState.player.position.z,
  );
  if (!inRestArea) return null;
  const stageOk = chefQuest.stage === "proving";
  const alreadyToday = chefQuest.lastMealDay === gameState.currentDay;
  // 次數到門檻之後就不要再往上疊：門檻到了不會自動推進 stage（要等玩家去
  // 敲她家門口），累加次數卻不封頂的話，玩家會一直看到次數往上跳（4、5、
  // 6...）卻不知道自己到底卡在哪一步，容易誤以為又是新的 bug。
  const alreadyProven = hasEnoughSharedMeals();
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  const inWindow =
    hour >= CHEF_MEAL_WINDOW_START && hour < CHEF_MEAL_WINDOW_END;
  const hasFood = inventory.harvested > 0 || inventory.fish > 0;
  const npcPresent = isAnyNpcPresent();
  return {
    ok:
      stageOk &&
      !alreadyToday &&
      !alreadyProven &&
      inWindow &&
      hasFood &&
      npcPresent,
    inRestArea,
    alreadyToday,
    alreadyProven,
    hour,
    inWindow,
    hasFood,
    npcPresent,
  };
}

function logChefMealFailure(
  conditions: NonNullable<ReturnType<typeof evaluateChefMealConditions>>,
) {
  // 這個不是「條件沒湊齊」的失敗，是「已經證明過了，次數故意不再往上跳」，
  // 訊息要跟下面那種「哪個條件不滿足」的診斷分開講，避免又被誤讀成 bug。
  if (conditions.alreadyProven) {
    console.info(
      `[廚師共餐] 次數已達門檻 ${CHEF_MEAL_THRESHOLD}/${CHEF_MEAL_THRESHOLD}，不再繼續累加——` +
        `等玩家去敲她家門口觸發「條件達成」的場景才會推進 stage（門口觸碰點還沒接上座標前，這步測不到）。`,
    );
    return;
  }
  console.info(
    `[廚師共餐] 失敗 — quest階段: ${chefQuest.stage}(需要proving) / ` +
      `今天已用過: ${conditions.alreadyToday} / 在休息區: ${conditions.inRestArea} / ` +
      `時間: ${formatGameHour(conditions.hour)}(需要${String(CHEF_MEAL_WINDOW_START).padStart(2, "0")}:00-${String(CHEF_MEAL_WINDOW_END).padStart(2, "0")}:00內) / ` +
      `有收成或漁獲: ${conditions.hasFood} / 同地圖有NPC在場: ${conditions.npcPresent}`,
  );
}

// 條件已經確認全部成立時才呼叫：真的扣掉食物、累加次數，回傳共餐的對話
// 內容（純資料，不呼叫 showDialogSequence）——單獨觸發跟合併進閒聊台詞
// 兩條路徑都靠這個回傳值組出最終要顯示的那組對話。
function applyChefMeal() {
  if (inventory.harvested > 0) inventory.harvested--;
  else inventory.fish--;
  chefQuest.lastMealDay = gameState.currentDay;
  chefQuest.sharedMealCount++;
  nearAnyNpc(); // 這次是真的成立的共餐，補呼叫一次讓在場 NPC 印象值照舊+1
  console.info(
    `[廚師] 共餐次數 ${chefQuest.sharedMealCount}/${CHEF_MEAL_THRESHOLD}`,
  );
  const lines: (string | { text: string })[] = [
    "[你把今天的收穫分給大家，簡單但暖和的一餐]",
  ];
  if (hasEnoughSharedMeals()) {
    lines.push("[不知道什麼時候開始，廚師已經站在不遠處看著這一切]");
  }
  return lines;
}

// E 鍵處理裡「附近沒有可以聊天的 NPC」時走的路徑：單獨判斷、單獨顯示，
// 條件不成立時把診斷結果印出來（玩家站在休息區特地按 E，代表他很可能
// 就是在嘗試共餐，這種情況才需要告訴他是哪個環節不對）。
export function tryShareChefMeal() {
  const conditions = evaluateChefMealConditions();
  if (!conditions) return false;
  if (!conditions.ok) {
    logChefMealFailure(conditions);
    return false;
  }
  showDialogSequence(applyChefMeal());
  return true;
}

// E 鍵處理裡「附近有 NPC 可以聊天」時走的路徑：日常閒聊台詞永遠都會顯示，
// 不會因為共餐條件湊齊就被跳過——共餐條件同時成立時，用「對了……」接在
// 閒聊後面，兩段接成同一組 showDialogSequence；條件不成立就回傳 null，
// 呼叫端維持原樣只顯示 chatLine，不加轉折詞（沒有下文可接，硬加會很怪），
// 也不印失敗診斷——玩家這時候是單純想聊天，不代表他在嘗試共餐。
export function mergeChefMealIntoChatLine(chatLine: {
  text: string;
  speaker?: string;
  name?: string;
}) {
  const conditions = evaluateChefMealConditions();
  if (!conditions || !conditions.ok) return null;
  return [
    chatLine,
    { text: "「對了……」", speaker: chatLine.speaker, name: chatLine.name },
    ...applyChefMeal(),
  ];
}
