import {
  gameState,
  inventory,
  isNightTime,
  TIME_CONFIG,
} from "./game-state";
import {
  carpenterQuest,
  CARPENTER_MATERIALS,
  CARPENTER_EVENT_WAIT_POS,
} from "./layout-maps";
import { showDialog, showDialogSequence, dialogQueue } from "./dialogue";
import { npcGroup, npcs } from "./npc-runtime";
import { t } from "./i18n";

export function carpenterHasMaterials() {
  return (
    inventory.wood >= CARPENTER_MATERIALS.wood &&
    inventory.stone >= CARPENTER_MATERIALS.stone
  );
}
export function startCarpenterDockScene() {
  carpenterQuest.stage = "escorting";
  const fade = document.getElementById("fade") as HTMLElement;
  fade.style.opacity = "1";
  setTimeout(() => {
    const mayor = npcs.find((n) => n.id === "mayor");
    const carpenter = npcs.find((n) => n.id === "carpenter");
    npcGroup.visible = true;
    // 兩人一開始就疊在主角腳下（不是左右錯開的固定偏移），高度也直接
    // 抄主角當下算好的世界座標 Y。escort 的「跟走」邏輯（game-loop.ts
    // 的 sampleCarpenterEscortTrail）只認主角走過的軌跡點，起點偏到
    // 側邊/用假高度會讓兩人一開始就落在軌跡以外，直到主角走出足夠
    // 距離把這個假起點推出取樣窗口前，都會穿到台子/樓梯下面。
    if (mayor) {
      mayor.mesh.visible = true;
      mayor.mesh.position.set(
        gameState.player.position.x,
        gameState.player.position.y,
        gameState.player.position.z,
      );
    }
    if (carpenter) {
      carpenter.mesh.visible = true;
      carpenter.mesh.position.set(
        gameState.player.position.x,
        gameState.player.position.y,
        gameState.player.position.z,
      );
    }
    fade.style.opacity = "0";
    showDialogSequence([
      {
        text: t("carpenter.dock.mayorIntro"),
        speaker: "mayor",
        name: t("carpenter.name.mayor"),
      },
      t("carpenter.dock.narrationArrive"),
      {
        text: t("carpenter.dock.carpenterPlank"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      {
        text: t("carpenter.dock.mayorWelcome"),
        speaker: "mayor",
        name: t("carpenter.name.mayor"),
      },
      {
        text: t("carpenter.dock.carpenterKneel"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      {
        text: t("carpenter.dock.mayorLaugh"),
        speaker: "mayor",
        name: t("carpenter.name.mayor"),
      },
    ]);
  }, 400);
}
export function canStartCarpenterDockScene() {
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  return gameState.currentDay === 1 && hour >= 8 && hour < 8.5;
}

export function handleCarpenterDockTouch() {
  if (dialogQueue.length) return; // 對話播放中不要被重新觸發打斷
  if (carpenterQuest.stage === "not_started") {
    if (!canStartCarpenterDockScene()) return;
    startCarpenterDockScene();
  }
}
export function tryStartCarpenterConstruction() {
  if (!carpenterHasMaterials()) {
    carpenterQuest.stage = "escorting";
    showDialog({
      text: t("carpenter.materialsNotEnough"),
      speaker: "carpenter",
      name: t("carpenter.name.carpenter"),
    });
    return;
  }
  inventory.wood -= CARPENTER_MATERIALS.wood;
  inventory.stone -= CARPENTER_MATERIALS.stone;
  carpenterQuest.stage = "construction";
  carpenterQuest.constructionStartDay = gameState.currentDay;
  const carpenterNpc = npcs.find((n) => n.id === "carpenter");
  if (carpenterNpc) {
    carpenterNpc.mesh.visible = true;
    carpenterNpc.mesh.position.x = CARPENTER_EVENT_WAIT_POS.x;
    carpenterNpc.mesh.position.z = CARPENTER_EVENT_WAIT_POS.z;
  }
  npcGroup.visible = true;
  showDialogSequence([
    {
      text: t("carpenter.construction.start1"),
      speaker: "carpenter",
      name: t("carpenter.name.carpenter"),
    },
    {
      text: t("carpenter.construction.start2"),
      speaker: "carpenter",
      name: t("carpenter.name.carpenter"),
    },
  ]);
}
export function startCarpenterVillageScene() {
  carpenterQuest.stage = "village_scene_done"; // 立刻推進，避免對話播放中重複觸發
  const carpenterNpc = npcs.find((n) => n.id === "carpenter");
  if (carpenterNpc) {
    carpenterNpc.mesh.position.x = CARPENTER_EVENT_WAIT_POS.x;
    carpenterNpc.mesh.position.z = CARPENTER_EVENT_WAIT_POS.z;
  }
  showDialogSequence(
    [
      t("carpenter.village.narrationWalk"),
      {
        text: t("carpenter.village.mutter"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      t("carpenter.village.narrationDoor"),
      t("carpenter.village.playerAsk"),
      {
        text: t("carpenter.village.ok"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      {
        text: t("carpenter.village.builtMany"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      {
        text: t("carpenter.village.odd"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
      {
        text: t("carpenter.village.materialsAsk"),
        speaker: "carpenter",
        name: t("carpenter.name.carpenter"),
      },
    ],
    tryStartCarpenterConstruction,
  );
}
export function startCarpenterMoveInScene() {
  carpenterQuest.stage = "moved_in";
  showDialogSequence([
    t("carpenter.moveIn.narrationLight"),
    {
      // 這是刻意選定的「關鍵劇情節點」CG 掛點：入住當晚的收尾這一句份量
      // 夠重，值得全螢幕 CG。圖檔還沒生成，src/assets/cg/ 沒有對應檔案
      // 時 setDialogCg() 會 warn 一聲然後留在原本的 3D 畫面，不會卡住。
      text: t("carpenter.moveIn.final"),
      speaker: "carpenter",
      name: t("carpenter.name.carpenter"),
      cg: "carpenter_movein",
      cgDescription: "木匠入住收尾",
    },
  ]);
  const carpenterNpc = npcs.find((n) => n.id === "carpenter");
  if (carpenterNpc) carpenterNpc.mesh.visible = true;
}
export function handleCarpenterDoorstepTouch() {
  if (dialogQueue.length) return;
  if (carpenterQuest.stage === "escorting") {
    startCarpenterVillageScene();
  } else if (carpenterQuest.stage === "ready_for_move_in" && isNightTime()) {
    startCarpenterMoveInScene();
  }
}
