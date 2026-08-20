import { gameState, inventory, cropState, TIME_CONFIG, SEASON_NAMES, WEATHER_NAMES, getSeasonDay, getSeasonPeriod, rollWeatherForSeason, growCropsForNewDay, nearWater, plantSeed, harvestCrop, pickupSeeds, CAST_ANIM_DURATION, OYSTER_RACK_TILES, oysterRackState, harvestOysterRack } from "./game-state";
import { updateSeasonAndDate } from "./game-clock";
import { carpenterQuest, POUCH_POS, FARMLAND_TILES, chefQuest, REST_CHAIR } from "./layout-maps";
import { tryShareChefMeal, mergeChefMealIntoChatLine } from "./chef-quest";
import { npcGroup, npcs } from "./npc-runtime";
import { npcLine } from "./npc-defs";
import { dialogQueue, advanceDialogSequence, showDialog, showDialogSequence, dialogEl } from "./dialogue";
import { loadMap, isBlocked, events } from "./build-map";
import { updateAvenueTreeColors, updateSeasonalTreeColors, updateSeasonalGroundColors, makeBobber, makeFishProp } from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import { scene, renderer, clearMeteors, scheduleNextMeteor, updateCameraFrustum, meteorPool, getMeteorShowerHudLabel, groundY } from "./scene-sky";
import { setThresholdMarkersVisible } from "./scene-registries";

export const SAVE_KEY_PREFIX = "meadowtide.save.";
      export function saveGame(slot = "default") {
        const data = {
          version: 2,
          elapsed: gameState.elapsed,
          currentDay: gameState.currentDay,
          currentPhase: gameState.currentPhase,
          currentSeason: gameState.currentSeason,
          currentWeather: gameState.currentWeather,
          pouchCollectedDay: gameState.pouchCollectedDay,
          currentMapName: gameState.currentMapName,
          player: gameState.player
            ? { x: gameState.player.position.x, z: gameState.player.position.z, facing: gameState.facing }
            : null,
          inventory: { ...inventory },
          crops: JSON.parse(JSON.stringify(cropState)),
          npcMemory: npcs.map((npc) => ({ id: npc.id, memory: npc.memory })),
          carpenterQuest: { ...carpenterQuest },
          oysterRackState: JSON.parse(JSON.stringify(oysterRackState)),
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
        gameState.currentWeather =
          data.currentWeather || rollWeatherForSeason(gameState.currentSeason);
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
              carpenterQuest.stage === "moved_in";
          const escortMap = data.currentMapName === "port" || data.currentMapName === "oldVillage";
          npcGroup.visible =
            data.currentMapName === "livingArea" ||
            data.currentMapName === "oldVillage" ||
            ((carpenterQuest.stage === "escorting" ||
              carpenterQuest.stage === "village_scene_done") && escortMap);
          if (
            (carpenterQuest.stage === "escorting" ||
              carpenterQuest.stage === "village_scene_done") &&
            escortMap
          ) {
            const auntNpc = npcs.find((n) => n.id === "aunt");
            if (auntNpc) auntNpc.mesh.visible = true;
          }
        }
        Object.keys(oysterRackState).forEach((key) => delete oysterRackState[key]);
        Object.assign(oysterRackState, data.oysterRackState || {});
        if (data.player) {
          const targetMap = data.currentMapName || "livingArea";
          if (targetMap !== gameState.currentMapName) {
            loadMap(targetMap, { x: data.player.x, z: data.player.z });
          } else if (gameState.player) {
            gameState.player.position.x = data.player.x;
            gameState.player.position.z = data.player.z;
            gameState.playerGridPos = {
              x: Math.round(data.player.x),
              z: Math.round(data.player.z),
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
            const auntNpc = npcs.find((n) => n.id === "aunt");
            const carpenterNpc = npcs.find((n) => n.id === "carpenter");
            if (auntNpc)
              auntNpc.mesh.position.set(
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
          console.info(
            loadGame() ? "[讀檔] 已載入 default 欄位" : "[讀檔] 尚無存檔",
          );
        }
      });

      export const keys = {};
      addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
      addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
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
      renderer.domElement.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 2) return;
        pinchStartDistance = touchDistance(e.touches);
        pinchStartZoom = gameState.zoom;
        e.preventDefault();
      }, { passive: false });
      renderer.domElement.addEventListener("touchmove", (e) => {
        if (e.touches.length !== 2 || pinchStartDistance <= 0) return;
        const distance = touchDistance(e.touches);
        if (distance > 0) {
          setCameraZoom(pinchStartZoom * pinchStartDistance / distance);
        }
        e.preventDefault();
      }, { passive: false });
      const endPinch = () => {
        pinchStartDistance = 0;
      };
      renderer.domElement.addEventListener("touchend", endPinch);
      renderer.domElement.addEventListener("touchcancel", endPinch);

      addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() !== "e" || gameState.ePressed) return;
        gameState.ePressed = true;

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

        if (gameState.currentMapName === "livingArea" && nearWater()) {
          if (gameState.fishingState === "idle") {
            gameState.fishingState = "casting";
            gameState.fishingTimer = 0;
            gameState.biteWaitTime = 1.4 + Math.random() * 2.6;
            gameState.bobberMesh = makeBobber();
            scene.add(gameState.bobberMesh);
            gameState.castAnimEnd = gameState.elapsed + CAST_ANIM_DURATION;
            if (gameState.player.parts.rod) gameState.player.parts.rod.visible = true;
          } else if (gameState.fishingState === "biting") {
            inventory.fish++;
            gameState.fishingState = "idle";
            const catchFrom = gameState.bobberMesh
              ? gameState.bobberMesh.position.clone()
              : gameState.player.position.clone();
            if (gameState.bobberMesh) {
              scene.remove(gameState.bobberMesh);
              gameState.bobberMesh = null;
            }
            if (gameState.player.parts.rod) gameState.player.parts.rod.visible = false;
            gameState.fishFeedback = { text: "釣到一隻魚！", until: gameState.elapsed + 1.4 };
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
        const onOysterRack = OYSTER_RACK_TILES.some(
          ([ox, oz]) => ox === x && oz === z,
        );
        if (onOysterRack) {
          harvestOysterRack(x, z);
          return;
        }
        const onFarmland = FARMLAND_TILES.some(
          ([fx, fz]) => fx === x && fz === z,
        );
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
        hudEl.innerHTML = `${SEASON_NAMES[gameState.currentSeason]}季 ・ 第 <b>${getSeasonDay()}</b> 日（${getSeasonPeriod()}）・ ${weatherLabel} ・ ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${gameState.musicMuted ? " ・ 靜音" : ""}<br>種子 <b>${inventory.seeds}</b> ・ 收成 <b>${inventory.harvested}</b> ・ 魚 <b>${inventory.fish}</b><br>阿姨印象 <b>${npcs[0].memory}</b> ・ 木匠印象 <b>${npcs[1].memory}</b>`;
      }
