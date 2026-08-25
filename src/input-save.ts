import {
  gameState,
  inventory,
  cropState,
  TIME_CONFIG,
  SEASON_NAMES,
  WEATHER_NAMES,
  getSeasonDay,
  getSeasonPeriod,
  rollWeatherForSeason,
  growCropsForNewDay,
  nearWater,
  plantSeed,
  harvestCrop,
  pickupSeeds,
  CAST_ANIM_DURATION,
  OYSTER_RACK_TILES,
  oysterRackState,
  harvestOysterRack,
  FEEDER_VISUAL,
  FEEDER_CAPACITY,
  refillFeeder,
  WOOD_NODES,
  STONE_NODES,
  harvestGatherNode,
  refreshGatherNodes,
  cookMeal,
} from "./game-state";
import { updateSeasonAndDate } from "./game-clock";
import { ORE_NODES, harvestOreNode } from "./mine";
import {
  playRandomSfx,
  CHOP_WOOD_SFX,
  MINE_ORE_SFX,
  FISH_CAST_SFX,
  FISH_REEL_SFX,
} from "./sfx";
import {
  carpenterQuest,
  POUCH_POS,
  FARMLAND_TILES,
  chefQuest,
  REST_CHAIR,
  MAPS,
} from "./layout-maps";
import { tryShareChefMeal, mergeChefMealIntoChatLine } from "./chef-quest";
import { npcGroup, npcs } from "./npc-runtime";
import { npcLine } from "./npc-defs";
import {
  dialogQueue,
  advanceDialogSequence,
  showDialog,
  showDialogSequence,
  dialogEl,
  activeChoice,
  handleChoiceDigitKey,
  advanceChoicePage,
} from "./dialogue";
import { loadMap, isBlocked, events } from "./build-map";
import {
  updateAvenueTreeColors,
  updateSeasonalTreeColors,
  updateSeasonalGroundColors,
  makeBobber,
  makeFishProp,
  makeChipDebris,
  makeOreChipDebris,
} from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import {
  scene,
  renderer,
  clearMeteors,
  scheduleNextMeteor,
  updateCameraFrustum,
  meteorPool,
  getMeteorShowerHudLabel,
  groundY,
} from "./scene-sky";
import { gatherNodeMeshes, oreNodeMeshes, setThresholdMarkersVisible } from "./scene-registries";

export const SAVE_KEY_PREFIX = "meadowtide.save.";
export function saveGame(slot = "default") {
  const data = {
    version: 4,
    elapsed: gameState.elapsed,
    currentDay: gameState.currentDay,
    currentPhase: gameState.currentPhase,
    currentSeason: gameState.currentSeason,
    currentWeather: gameState.currentWeather,
    weatherSchedules: JSON.parse(JSON.stringify(gameState.weatherSchedules)),
    pouchCollectedDay: gameState.pouchCollectedDay,
    currentMapName: gameState.currentMapName,
    player: gameState.player
      ? {
          x: gameState.player.position.x,
          z: gameState.player.position.z,
          facing: gameState.facing,
        }
      : null,
    inventory: { ...inventory },
    crops: JSON.parse(JSON.stringify(cropState)),
    npcMemory: npcs.map((npc) => ({ id: npc.id, memory: npc.memory })),
    carpenterQuest: { ...carpenterQuest },
    oysterRackState: JSON.parse(JSON.stringify(oysterRackState)),
    gatherSpawnSlot: gameState.gatherSpawnSlot,
    woodNodes: JSON.parse(JSON.stringify(WOOD_NODES)),
    stoneNodes: JSON.parse(JSON.stringify(STONE_NODES)),
    // 洞窟樓層+礦石節點——不像 woodNodes/stoneNodes 有「刷新時段」欄位，
    // 單純存目前樓層跟該層的採集狀態；讀檔時只還原資料，實際地磚/模型
    // 由 loadMap() 的 regenerateMineFloor() 保險呼叫重新生成(見
    // build-map.ts)，這裡不用另外存 tiles。
    mineFloor: gameState.mineFloor,
    oreNodes: JSON.parse(JSON.stringify(ORE_NODES)),
  };
  localStorage.setItem(SAVE_KEY_PREFIX + slot, JSON.stringify(data));
  return data;
}

export function loadGame(slot = "default") {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
  if (!raw) return false;
  const data = JSON.parse(raw);
  gameState.elapsed = Math.max(0, Number(data.elapsed) || 0);
  updateSeasonAndDate();
  gameState.prevDay = gameState.currentDay;
  gameState.weatherSchedules = data.weatherSchedules || {};
  gameState.currentWeather =
    data.currentWeather ||
    rollWeatherForSeason(gameState.currentSeason, gameState.currentDay);
  gameState.pouchCollectedDay = Number.isFinite(data.pouchCollectedDay)
    ? data.pouchCollectedDay
    : -1;
  Object.assign(inventory, data.inventory || {});
  Object.keys(cropState).forEach((key) => delete cropState[key]);
  Object.assign(cropState, data.crops || {});
  (data.npcMemory || []).forEach((savedNpc) => {
    const npc = npcs.find((candidate) => candidate.id === savedNpc.id);
    if (npc) npc.memory = savedNpc.memory;
  });
  if (data.carpenterQuest) {
    Object.assign(carpenterQuest, data.carpenterQuest);
    if (carpenterQuest.stage === "en_route_village")
      carpenterQuest.stage = "escorting";
    const carpenterNpc = npcs.find((n) => n.id === "carpenter");
    if (carpenterNpc)
      carpenterNpc.mesh.visible =
        carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done" ||
        carpenterQuest.stage === "moved_in" ||
        ((carpenterQuest.stage === "construction" ||
          carpenterQuest.stage === "ready_for_move_in") &&
          data.currentMapName === "oldVillage");
    const escortMap =
      data.currentMapName === "port" || data.currentMapName === "oldVillage";
    npcGroup.visible =
      data.currentMapName === "livingArea" ||
      data.currentMapName === "oldVillage" ||
      ((carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
        escortMap);
    if (
      (carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
      escortMap
    ) {
      const mayorNpc = npcs.find((n) => n.id === "mayor");
      if (mayorNpc) mayorNpc.mesh.visible = true;
    }
  }
  Object.keys(oysterRackState).forEach((key) => delete oysterRackState[key]);
  Object.assign(oysterRackState, data.oysterRackState || {});
  if (Array.isArray(data.woodNodes) && Array.isArray(data.stoneNodes)) {
    gameState.gatherSpawnSlot = Number(data.gatherSpawnSlot);
    WOOD_NODES.splice(0, WOOD_NODES.length, ...data.woodNodes);
    STONE_NODES.splice(0, STONE_NODES.length, ...data.stoneNodes);
  } else {
    refreshGatherNodes(true);
  }
  gameState.mineFloor = Number.isFinite(data.mineFloor) ? data.mineFloor : 1;
  if (Array.isArray(data.oreNodes)) {
    ORE_NODES.splice(0, ORE_NODES.length, ...data.oreNodes);
  }
  if (data.player) {
    const targetMap = data.currentMapName || "livingArea";
    if (targetMap !== gameState.currentMapName) {
      loadMap(targetMap, { x: data.player.x, z: data.player.z });
    } else if (gameState.player) {
      const savedPositionIsBlocked = collidesAt(
        targetMap,
        data.player.x,
        data.player.z,
      );
      const restoredPosition = savedPositionIsBlocked
        ? MAPS[targetMap].playerStart
        : data.player;
      gameState.player.position.x = restoredPosition.x;
      gameState.player.position.z = restoredPosition.z;
      gameState.playerGridPos = {
        x: Math.round(restoredPosition.x),
        z: Math.round(restoredPosition.z),
      };
    }
    gameState.facing = data.player.facing || gameState.facing;
    if (
      carpenterQuest.stage === "escorting" ||
      carpenterQuest.stage === "village_scene_done"
    ) {
      // 跟 build-map.ts loadMap() 的 escort 重置邏輯一致：疊在主角腳下、
      // 用主角當下算好的世界座標 Y，不要用側邊固定偏移 + 寫死 y=0
      // （那組數字跟地形無關，讀檔一進 oldVillage/port 就會穿模）。
      const mayorNpc = npcs.find((n) => n.id === "mayor");
      const carpenterNpc = npcs.find((n) => n.id === "carpenter");
      if (mayorNpc)
        mayorNpc.mesh.position.set(
          data.player.x,
          gameState.player.position.y,
          data.player.z,
        );
      if (carpenterNpc)
        carpenterNpc.mesh.position.set(
          data.player.x,
          gameState.player.position.y,
          data.player.z,
        );
    }
  }
  updateAvenueTreeColors();
  updateSeasonalTreeColors();
  updateSeasonalGroundColors();
  growCropsForNewDay();
  syncFarmVisuals();
  clearMeteors();
  scheduleNextMeteor(true);
  updateHud();
  return true;
}
(window as any).saveGame = saveGame;
(window as any).loadGame = loadGame;
addEventListener("keydown", (event) => {
  if (event.key === "F6") {
    event.preventDefault();
    saveGame();
    console.info("[存檔] 已儲存 default 欄位");
  } else if (event.key === "F9") {
    event.preventDefault();
    console.info(loadGame() ? "[讀檔] 已載入 default 欄位" : "[讀檔] 尚無存檔");
  }
});

export const keys = {};
addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
// 二選一提示的數字鍵選擇/翻頁——跟上面 E 鍵/WASD 分開一個監聽，純粹只
// 在 activeChoice 有值時吃鍵，其他時候完全不影響移動/互動。數字鍵選當前
// 頁看到的選項；選項超過一頁(CHOICE_PAGE_SIZE=3)時 Tab 鍵循環翻頁——
// preventDefault 是因為 Tab 預設會把瀏覽器焦點移出畫布，會讓後續鍵盤
// 輸入吃不到。
addEventListener("keydown", (e) => {
  if (handleChoiceDigitKey(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === "Tab" && activeChoice) {
    if (advanceChoicePage()) e.preventDefault();
  }
});
function setCameraZoom(zoom) {
  const maxZoom = gameState.currentMapName === "port" ? 20 : 18;
  gameState.zoom = Math.max(2, Math.min(maxZoom, zoom));
  updateCameraFrustum();
}
addEventListener("wheel", (e) => {
  setCameraZoom(gameState.zoom + e.deltaY * 0.01);
});

let pinchStartDistance = 0;
let pinchStartZoom = gameState.zoom;
function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 2) return;
    pinchStartDistance = touchDistance(e.touches);
    pinchStartZoom = gameState.zoom;
    e.preventDefault();
  },
  { passive: false },
);
renderer.domElement.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length !== 2 || pinchStartDistance <= 0) return;
    const distance = touchDistance(e.touches);
    if (distance > 0) {
      setCameraZoom((pinchStartZoom * pinchStartDistance) / distance);
    }
    e.preventDefault();
  },
  { passive: false },
);
const endPinch = () => {
  pinchStartDistance = 0;
};
renderer.domElement.addEventListener("touchend", endPinch);
renderer.domElement.addEventListener("touchcancel", endPinch);

addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "e" || gameState.ePressed) return;
  gameState.ePressed = true;

  // 選項提示開著的時候 E 鍵完全不處理——只認數字鍵/滑鼠點擊(見下面另一
  // 個 keydown 監聽)，不然 E 會被底下的 dialogQueue 判斷或其他互動邏輯
  // 接手，玩家可能還沒選就誤觸別的東西。
  if (activeChoice) return;

  // 對話正在進行中：E 只用來往下推句子，不觸發任何其他動作
  if (dialogQueue.length) {
    advanceDialogSequence();
    return;
  }

  if (gameState.isSitting) {
    gameState.isSitting = false;
    return;
  }

  if (
    gameState.currentMapName === "livingArea" &&
    gameState.fishingState === "idle" &&
    Math.hypot(
      gameState.player.position.x - REST_CHAIR.x,
      gameState.player.position.z - REST_CHAIR.z,
    ) <= 1.25
  ) {
    gameState.isSitting = true;
    gameState.isMoving = false;
    gameState.player.position.set(
      REST_CHAIR.x,
      groundY(REST_CHAIR.x, REST_CHAIR.z) - 0.03,
      REST_CHAIR.z,
    );
    gameState.player.rotation.y = REST_CHAIR.playerRotation;
    gameState.playerGridPos = {
      x: Math.round(REST_CHAIR.x),
      z: Math.round(REST_CHAIR.z),
    };
    return;
  }

  const scripted = events
    .filter(
      (ev) => ev.map === gameState.currentMapName && ev.trigger === "interact",
    )
    .filter(
      (ev) =>
        Math.abs(ev.x - gameState.playerGridPos.x) +
          Math.abs(ev.z - gameState.playerGridPos.z) <=
        1,
    );
  if (scripted.length) {
    scripted.forEach((ev) => ev.action());
    return;
  }

  if (
    gameState.currentMapName === "livingArea" ||
    gameState.currentMapName === "oldVillage"
  ) {
    const nearby = npcs.find((n) => {
      if (!n.mesh.visible) return false; // 木匠抵達前不算「在場」，不能對話
      if (n.map !== gameState.currentMapName) return false;
      const dx = gameState.player.position.x - n.mesh.position.x,
        dz = gameState.player.position.z - n.mesh.position.z;
      return Math.sqrt(dx * dx + dz * dz) <= 1.3;
    });
    if (nearby) {
      const chatLine = npcLine(nearby);
      // 閒聊台詞永遠都會顯示；共餐條件如果剛好也同時成立，用「對了……」
      // 接在後面串成一組，不是讓共餐搶走閒聊——玩家單純想打招呼時不該
      // 連一句「哈囉」都聽不到。
      const merged = mergeChefMealIntoChatLine(chatLine);
      if (merged) showDialogSequence(merged);
      else showDialog(chatLine);
      return;
    }
  }

  if (gameState.currentMapName === "livingArea" && tryShareChefMeal()) {
    return;
  }

  // 牡蠣架的沙灘互動格緊貼海邊，這個判定一定要排在下面的 nearWater()
  // 釣魚判定之前——不然站在那格按 E 一定會被釣魚搶走(那格 nearWater()
  // 必然是 true)，之前就是這樣才會站在牡蠣架旁邊按 E 卻跳出釣魚提示、
  // 牡蠣完全採不到。
  if (gameState.currentMapName === "livingArea") {
    const { x: oysterX, z: oysterZ } = gameState.playerGridPos;
    const onOysterRack = OYSTER_RACK_TILES.some(
      ([ox, oz]) => ox === oysterX && oz === oysterZ,
    );
    if (onOysterRack) {
      harvestOysterRack(oysterX, oysterZ);
      return;
    }
  }

  // 動物投餵機——半徑判定跟休息椅同一招(1.5 格內即可，不用逼玩家精確
  // 站上哪一格)；免費補滿(補料的資源成本之後有經濟系統再設計)。
  if (
    gameState.currentMapName === "livingArea" &&
    Math.hypot(
      gameState.player.position.x - FEEDER_VISUAL.x,
      gameState.player.position.z - FEEDER_VISUAL.z,
    ) <= FEEDER_VISUAL.interactionRadius
  ) {
    const added = refillFeeder();
    gameState.harvestFeedback =
      added > 0
        ? {
            kind: "success",
            title: "投餵機",
            text: `已補滿：${gameState.feederUnits}／${FEEDER_CAPACITY}`,
            until: gameState.elapsed + 2.6,
          }
        : {
            kind: "empty",
            title: "投餵機",
            text: `已經是滿的：${gameState.feederUnits}／${FEEDER_CAPACITY}`,
            until: gameState.elapsed + 2.6,
          };
    return;
  }

  // 木材/石頭採集點——玩家預設已經拿到斧頭，站在採集點旁邊(曼哈頓距離
  // <=1，跟上面 scripted interact events 同一種判定)按 E 就會揮斧採集。
  // 兩種資源座標清單分開存，但共用同一套「今天採過了嗎」邏輯
  // (harvestGatherNode)，採集成功會順便丟出幾片木屑/碎石飛散演出。
  if (
    gameState.currentMapName === "mountain" ||
    gameState.currentMapName === "livingArea"
  ) {
    const { x: gx, z: gz } = gameState.playerGridPos;
    const nearNode = (n: { x: number; z: number; map: string; collected?: boolean }) =>
      n.map === gameState.currentMapName &&
      !n.collected &&
      Math.abs(n.x - gx) + Math.abs(n.z - gz) <= 1;
    const woodNode = WOOD_NODES.find(nearNode);
    const stoneNode = !woodNode && STONE_NODES.find(nearNode);
    const gatherNode = woodNode || stoneNode;
    if (gatherNode) {
      const kind = woodNode ? "wood" : "stone";
      const granted = harvestGatherNode(kind, gatherNode.x, gatherNode.z);
      if (granted > 0) {
        if (kind === "wood") playRandomSfx(CHOP_WOOD_SFX);
        const harvestedNode = woodNode || stoneNode;
        const meshEntry = gatherNodeMeshes.find(
          (entry) => entry.nodeId === harvestedNode.id,
        );
        if (meshEntry) meshEntry.group.visible = false;
        for (let i = 0; i < 3; i++) {
          const chip = makeChipDebris(kind, Math.random());
          chip.position.set(
            gatherNode.x + (Math.random() - 0.5) * 0.3,
            gameState.player.position.y + 0.3,
            gatherNode.z + (Math.random() - 0.5) * 0.3,
          );
          scene.add(chip);
          gameState.gatherChipAnims.push({
            mesh: chip,
            vx: (Math.random() - 0.5) * 1.4,
            vy: 1.6 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 1.4,
            start: gameState.elapsed,
            duration: 0.6,
          });
        }
      }
      return;
    }
  }

  // 鐘乳石洞窟礦石——跟木材/石頭同一種鄰接判定(曼哈頓距離<=1)，但獨立
  // 一份清單/邏輯(mine.ts)，不跟地表採集共用：採到的種類/顏色都吃目前
  // 樓層對應的礦石階層，跟日夜時段無關，換樓層才會重灑。
  if (gameState.currentMapName === "stalactiteCave") {
    const { x: mx, z: mz } = gameState.playerGridPos;
    const oreNode = ORE_NODES.find(
      (n) => !n.collected && Math.abs(n.x - mx) + Math.abs(n.z - mz) <= 1,
    );
    if (oreNode) {
      const result = harvestOreNode(oreNode.x, oreNode.z);
      if (result.amount > 0 && result.tier) {
        playRandomSfx(MINE_ORE_SFX);
        const meshEntry = oreNodeMeshes.find(
          (entry) => entry.nodeId === oreNode.id,
        );
        if (meshEntry) meshEntry.group.visible = false;
        for (let i = 0; i < 3; i++) {
          const chip = makeOreChipDebris(result.tier.accentColor, Math.random());
          chip.position.set(
            oreNode.x + (Math.random() - 0.5) * 0.3,
            gameState.player.position.y + 0.3,
            oreNode.z + (Math.random() - 0.5) * 0.3,
          );
          scene.add(chip);
          gameState.gatherChipAnims.push({
            mesh: chip,
            vx: (Math.random() - 0.5) * 1.4,
            vy: 1.6 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 1.4,
            start: gameState.elapsed,
            duration: 0.6,
          });
        }
      }
      return;
    }
  }

  // 廚房爐台——房子裡按 E 就直接開煮(見 MAPS.house.furniture 的
  // stove)，跟採集點同一種曼哈頓距離<=1 判定，不用另外做選單。
  if (gameState.currentMapName === "house") {
    const { x: hx, z: hz } = gameState.playerGridPos;
    const stove = (MAPS.house.furniture || []).find(
      (item) => item.type === "stove",
    );
    if (stove && Math.abs(stove.x - hx) + Math.abs(stove.z - hz) <= 1) {
      cookMeal();
      return;
    }
  }

  if (gameState.currentMapName === "livingArea" && nearWater()) {
    if (gameState.fishingState === "idle") {
      playRandomSfx(FISH_CAST_SFX);
      gameState.fishingState = "casting";
      gameState.fishingTimer = 0;
      gameState.biteWaitTime = 1.4 + Math.random() * 2.6;
      gameState.bobberMesh = makeBobber();
      scene.add(gameState.bobberMesh);
      gameState.castAnimEnd = gameState.elapsed + CAST_ANIM_DURATION;
      if (gameState.player.parts.rod) gameState.player.parts.rod.visible = true;
    } else if (gameState.fishingState === "biting") {
      playRandomSfx(FISH_REEL_SFX);
      inventory.fish++;
      gameState.fishingState = "idle";
      const catchFrom = gameState.bobberMesh
        ? gameState.bobberMesh.position.clone()
        : gameState.player.position.clone();
      if (gameState.bobberMesh) {
        scene.remove(gameState.bobberMesh);
        gameState.bobberMesh = null;
      }
      if (gameState.player.parts.rod)
        gameState.player.parts.rod.visible = false;
      gameState.fishFeedback = {
        text: "釣到一隻魚！",
        until: gameState.elapsed + 1.4,
      };
      const flyingFish = makeFishProp(Math.random() * 100);
      flyingFish.scale.setScalar(1.7);
      scene.add(flyingFish);
      gameState.catchAnim = {
        mesh: flyingFish,
        from: catchFrom,
        start: gameState.elapsed,
        duration: 0.7,
      };
    }
    // casting 中途按 E 沒有作用——心急沒有用，這也是釣魚小遊戲的重點
    return;
  }

  if (gameState.currentMapName !== "livingArea") return;
  const { x, z } = gameState.playerGridPos;
  if (x === POUCH_POS.x && z === POUCH_POS.z) {
    pickupSeeds();
    return;
  }
  const onFarmland = FARMLAND_TILES.some(([fx, fz]) => fx === x && fz === z);
  if (onFarmland) {
    const key = `${x},${z}`;
    if (cropState[key] && cropState[key].stage >= 2) harvestCrop(x, z);
    else if (!cropState[key]) plantSeed(x, z);
  }
});
addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === "e") gameState.ePressed = false;
});

// 自由移動的碰撞判斷：玩家當成一個小正方形，四個角落分別去查
// 「這個角落現在在哪個格子、那格能不能走」，任何一個角落撞到就擋住，
// 這樣貼著牆邊走的時候是滑過去，不是整個人卡住
export function collidesAt(mapName, x, z, half = 0.22) {
  const corners = [
    [x - half, z - half],
    [x + half, z - half],
    [x - half, z + half],
    [x + half, z + half],
  ];
  return corners.some(([cx, cz]) => isBlocked(mapName, cx, cz));
}

// 廚師的碼頭/民宿觸碰點還沒有座標，proving/renovating 這段機制沒辦法
// 靠正常流程走到——先掛一個可直接改寫的除錯掛鉤，在主控台打
// __chefQuest.stage = "proving" 就能單獨測試共餐判定跟天數延遲，
// 不用等座標定案。這裡掛的是活物件本身（不是快照），改了會直接
// 影響遊戲狀態；座標接上、正式走過抵達事件之後留著也無妨。
// chef-quest.ts 裡在開發模式下把這個物件的欄位包成 getter/setter，
// 每次在主控台改動都會同步存進 localStorage，下次開發伺服器整頁
// 重新載入（改任何檔案幾乎都會觸發）時會自動讀回來——不用每次都
// 重新打一次 __chefQuest.stage = "proving"。
(window as any).__chefQuest = chefQuest;
// 所有地圖切換點的黃色門檻標記共用一個開關：除錯階段用得到、確認
// 座標之後想全部藏起來，不用一個一個地圖改 tile 資料，主控台打
// __setThresholdMarkersVisible(false) 就好，重新整理後也會維持
// （靠 thresholdMarkersVisible 這個模組層級變數，跟 buildMap()
// 每次重建地圖時套用的是同一份）。
(window as any).__setThresholdMarkersVisible = setThresholdMarkersVisible;
(window as any).__gameState = () => ({
  playerGridPos: gameState.playerGridPos,
  currentMapName: gameState.currentMapName,
  facing: gameState.facing,
  isMoving: gameState.isMoving,
  nightFactor: (window as any).__nightFactor || 0,
  season: SEASON_NAMES[gameState.currentSeason],
  weather: WEATHER_NAMES[gameState.currentWeather],
  musicMuted: gameState.musicMuted,
  dialogVisible:
    dialogEl.style.display !== "none" && dialogEl.style.display !== "",
  day: gameState.currentDay,
  seasonDay: getSeasonDay(),
  period: getSeasonPeriod(),
  time: gameState.currentPhase * TIME_CONFIG.gameHoursPerDay,
  activeMeteors: meteorPool.filter((meteor) => meteor.active).length,
  inventory: { ...inventory },
  fishingState: gameState.fishingState,
  npcs: npcs.map((n) => ({
    id: n.id,
    memory: n.memory,
    pos: { x: n.mesh.position.x, z: n.mesh.position.z },
  })),
  crops: JSON.parse(JSON.stringify(cropState)),
});

export const hudEl = document.getElementById("hud");
export function updateHud() {
  const gameHour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  const hh = Math.floor(gameHour) % TIME_CONFIG.gameHoursPerDay;
  const mm = Math.floor((gameHour - Math.floor(gameHour)) * 60);
  hudEl.dataset.activeMeteors = String(
    meteorPool.filter((meteor) => meteor.active).length,
  );
  hudEl.dataset.nightFactor = ((window as any).__nightFactor || 0).toFixed(3);
  const meteorShowerLabel = getMeteorShowerHudLabel();
  const weatherLabel = `${WEATHER_NAMES[gameState.currentWeather]}${meteorShowerLabel ? `・<b style="color:#a9d8ff">${meteorShowerLabel}</b>` : ""}`;
  hudEl.innerHTML = `${SEASON_NAMES[gameState.currentSeason]}季 ・ 第 <b>${getSeasonDay()}</b> 日（${getSeasonPeriod()}）・ ${weatherLabel} ・ ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${gameState.musicMuted ? " ・ 靜音" : ""}<br>種子 <b>${inventory.seeds}</b> ・ 收成 <b>${inventory.harvested}</b> ・ 魚 <b>${inventory.fish}</b> ・ 料理 <b>${Object.values(inventory.dishes).reduce((a, b) => a + b, 0)}</b><br>村長印象 <b>${npcs[0].memory}</b> ・ 木匠印象 <b>${npcs[1].memory}</b>`;
}
