import { gameState, inventory, isNightTime, nearAnyNpc, TIME_CONFIG } from "./game-state";
import {
  chefQuest,
  CHEF_MEAL_THRESHOLD,
  CHEF_MEAL_WINDOW_START,
  CHEF_MEAL_WINDOW_END,
  LAYOUT,
} from "./layout-maps";
import {
  showDialog,
  showDialogSequence,
  dialogQueue,
} from "./dialogue";
import { npcs } from "./npc-runtime";

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
    { text: "「啊——對，是東邊那戶。你鼻子真靈。」", speaker: "aunt", name: "村長" },
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
    { text: "「（蹲下看爐台）這個灶台還能用，煙道大概堵了。」", speaker: "chef" },
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
    { text: "「不是我端菜給你們吃那種。是你們自己，真的會聚在一起。」", speaker: "chef" },
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
    { text: "「進來吧，剛好夠一個人份。」", speaker: "chef" },
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
    x >= area.x && x < area.x + area.width && z >= area.z && z < area.z + area.height
  );
}

export function tryShareChefMeal() {
  if (chefQuest.stage !== "proving") return false;
  if (chefQuest.lastMealDay === gameState.currentDay) return false;
  if (!gameState.player) return false;
  if (!isInRestArea(gameState.player.position.x, gameState.player.position.z))
    return false;
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  if (hour < CHEF_MEAL_WINDOW_START || hour >= CHEF_MEAL_WINDOW_END) return false;
  if (inventory.harvested <= 0 && inventory.fish <= 0) return false;
  if (!nearAnyNpc()) return false;

  if (inventory.harvested > 0) inventory.harvested--;
  else inventory.fish--;
  chefQuest.lastMealDay = gameState.currentDay;
  chefQuest.sharedMealCount++;
  console.info(
    `[廚師] 共餐次數 ${chefQuest.sharedMealCount}/${CHEF_MEAL_THRESHOLD}`,
  );

  const lines: (string | { text: string })[] = [
    "[你把今天的收穫分給大家，簡單但暖和的一餐]",
  ];
  if (hasEnoughSharedMeals()) {
    lines.push("[不知道什麼時候開始，廚師已經站在不遠處看著這一切]");
  }
  showDialogSequence(lines);
  return true;
}
