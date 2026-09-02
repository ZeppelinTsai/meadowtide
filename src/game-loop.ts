import * as THREE from "three";
import { HELD_ARM_ROTATION } from "./held-item-pose";
import {
  gameState,
  TIME_CONFIG,
  dayLength,
  CAST_ANIM_DURATION,
  getNightFactor,
  isNightTime,
  isUnsafeAnimalWeather,
  nearWater,
  isOysterRackReady,
  WOOD_NODES,
  STONE_NODES,
  FLOWER_NODES,
  MUSHROOM_NODES,
  settlePastureGrazing,
  settleFeederConsumption,
  pastureGrassStageAt,
} from "./game-state";
import {
  isGameTimePaused,
  updateGameClock,
  updateSeasonAndDate,
} from "./game-clock";
import { isGameplayPaused } from "./time-pause";
import { cancelPlayerNavigation, getAutoMoveDirection } from "./player-navigation";
import {
  isAnimalCarried,
  recordAnimalFeedingDay,
  updateCarriedAnimalPose,
} from "./animal-interactions";
import { isInventoryOpen } from "./inventory-ui";
import { syncHeldItemVisual } from "./inventory-system";
import { translateText } from "./i18n";
import { rollFishTier, FISH_TIERS, COUNTER_DIRECTION } from "./fishing";
import { getGamepadLookInput, pollGamepad } from "./gamepad-input";
import {
  getGameplayCamera,
  getFirstPersonYaw,
  isFirstPersonModeActive,
  updateFirstPersonCamera,
} from "./first-person-camera";
import { firstPersonMoveVector } from "./first-person-movement";
import { vibrateGamepad, FISHING_HAPTICS } from "./gamepad-haptics";
import { playRandomSfx, FISH_BITE_SFX } from "./sfx";
import {
  updatePrologueCutscene,
  updatePrologueGameplayGate,
  isPrologueFarmingActive,
  isPrologueFishingTutorialActive,
  isPrologueCookingTutorialActive,
  isPrologueSeekingRod,
  isPrologueMayorFollowing,
  reportPrologueFishingFailure,
  startPrologueFishingSequence,
  isPrologueShipStage,
  reapplyProloguePlayerY,
  PROLOGUE_CAPTAIN_X,
  PROLOGUE_CAPTAIN_Z,
} from "./prologue";
import {
  LAYOUT,
  MAPS,
  carpenterQuest,
  CARPENTER_EVENT_WAIT_POS,
  SOUTHERNMOST_AVENUE_TREE_Z,
  aStar,
  portGroundY,
  oldVillageGroundY,
  isOnOldVillageStair,
  mountainGroundY,
  isOnMountainStair,
} from "./layout-maps";
import {
  npcGroup,
  npcs,
  animals,
  BARN_DOOR,
  randomPasturePoint,
  outsideCols,
  outsideRows,
} from "./npc-runtime";
import { getScheduleTarget } from "./npc-defs";
import {
  animateWalk,
  animateRun,
  animateSit,
  animateAnimalWalk,
} from "./humanoid";
import {
  chooseAnimalPastureTarget,
  setPastureGrassStage,
  startFishRoute,
  tryEatPastureGrass,
} from "./props";
import { dialogQueue } from "./dialogue";
import { isBlocked, events } from "./build-map";
import {
  dayTwoMorningEvent,
  canStartDayTwoMorningEvent,
  startDayTwoMorningEvent,
} from "./day2-morning-event";
import {
  collidesAt,
  keys,
  updateHud,
  advanceFishingQte,
  saveGame,
  getActiveSaveSlot,
} from "./input-save";
import { updateMusic } from "./music";
import {
  isCameraAdjustModeActive,
  updateCameraShots,
  updateCameraAdjustMode,
} from "./cutscene-camera";
import { updateWeatherEffects } from "./weather-particles";
import { updatePlanarWaterReflection } from "./water-reflection";
import { isOutdoorMap } from "./environment";
import {
  scene,
  camera,
  renderer,
  sun,
  ambient,
  seasonalBounceLight,
  DAY,
  NIGHT,
  TILT_RAD,
  CAMERA_WORLD_BOUNDS,
  groundY,
  AUTUMN_SUN_COLOR,
  SUMMER_SUN_COLOR,
  NOON_WARM_COLOR,
  WINTER_AMBIENT_COLOR,
  WINTER_BOUNCE_GROUND,
  WINTER_LIGHT_COLOR,
  SUMMER_BOUNCE_GROUND,
  INTERIOR_BACKGROUND_COLOR,
  updateMeteors,
  updateSkyDome,
  updateCameraFrustum,
} from "./scene-sky";
import {
  windowMats,
  waterSurfaceMaterials,
  waterSkyUnderlayMaterials,
  outdoorLampLights,
  foamMeshes,
  windmillRotors,
  fishSchool,
  pastureGrassBlades,
  gatherNodeMeshes,
  flowerNodeMeshes,
  mushroomNodeMeshes,
  celestialSparkleMaterials,
  EAST_SEA_WAVE,
  NORTH_SEA_WAVE,
  EAST_SEA_WAVE_DIRECTION,
  NORTH_SEA_WAVE_DIRECTION,
  sampleDirectedSeaWave,
  gangplankMeshes,
  prologueRefs,
  southIndoorWallMeshes,
} from "./scene-registries";

// 釣魚 QTE 浮動 HUD 用——可重複利用的 Vector3，每幀 project(camera) 前
// 覆寫座標即可，不用每幀 new，跟 scene-sky.ts 的 SUN_MASK_PROJECTED_POINT
// 同一個理由(避免每幀配置新物件造成 GC 壓力)。
const FISH_HUD_PROJECT_VEC = new THREE.Vector3();

type EscortTrailPoint = { x: number; z: number; rotation: number };
let carpenterEscortTrail: EscortTrailPoint[] = [];
let carpenterEscortTrailMap = "";

function updateCarpenterEscortTrail() {
  if (
    (carpenterQuest.stage !== "escorting" &&
      carpenterQuest.stage !== "village_scene_done") ||
    (gameState.currentMapName !== "port" &&
      gameState.currentMapName !== "oldVillage") ||
    !gameState.player
  ) {
    carpenterEscortTrail.length = 0;
    carpenterEscortTrailMap = "";
    return;
  }
  if (carpenterEscortTrailMap !== gameState.currentMapName) {
    carpenterEscortTrailMap = gameState.currentMapName;
    const mayor = npcs.find((npc) => npc.id === "mayor");
    const carpenter = npcs.find((npc) => npc.id === "carpenter");
    carpenterEscortTrail = [carpenter?.mesh, mayor?.mesh, gameState.player]
      .filter(Boolean)
      .map((mesh: any) => ({
        x: mesh.position.x,
        z: mesh.position.z,
        rotation: mesh.rotation.y,
      }));
  }
  const newest = carpenterEscortTrail[carpenterEscortTrail.length - 1];
  const playerPoint = {
    x: gameState.player.position.x,
    z: gameState.player.position.z,
    rotation: gameState.player.rotation.y,
  };
  if (
    !newest ||
    Math.hypot(playerPoint.x - newest.x, playerPoint.z - newest.z) >= 0.045
  )
    carpenterEscortTrail.push(playerPoint);
  if (carpenterEscortTrail.length > 260) carpenterEscortTrail.shift();
}

function sampleCarpenterEscortTrail(distanceBehind: number) {
  if (!carpenterEscortTrail.length) return null;
  let remaining = distanceBehind;
  for (let i = carpenterEscortTrail.length - 1; i > 0; i--) {
    const newer = carpenterEscortTrail[i];
    const older = carpenterEscortTrail[i - 1];
    const segment = Math.hypot(newer.x - older.x, newer.z - older.z);
    if (segment >= remaining) {
      const t = segment > 0 ? remaining / segment : 0;
      return {
        x: THREE.MathUtils.lerp(newer.x, older.x, t),
        z: THREE.MathUtils.lerp(newer.z, older.z, t),
        rotation: newer.rotation,
      };
    }
    remaining -= segment;
  }
  return carpenterEscortTrail[0];
}

let mayorPrologueTrail: EscortTrailPoint[] = [];
let mayorPrologueTrailMap = "";

function updateMayorPrologueTrail() {
  if (!isPrologueMayorFollowing() || !gameState.player) {
    mayorPrologueTrail.length = 0;
    mayorPrologueTrailMap = "";
    return;
  }
  if (mayorPrologueTrailMap !== gameState.currentMapName) {
    mayorPrologueTrailMap = gameState.currentMapName;
    const mayor = npcs.find((npc) => npc.id === "mayor");
    npcGroup.visible = true;
    if (mayor) {
      mayor.mesh.visible = true;
      mayor.mesh.position.copy(gameState.player.position);
      mayor.mesh.rotation.y = gameState.player.rotation.y;
    }
    mayorPrologueTrail = [{
      x: gameState.player.position.x,
      z: gameState.player.position.z,
      rotation: gameState.player.rotation.y,
    }];
  }
  const newest = mayorPrologueTrail[mayorPrologueTrail.length - 1];
  const playerPoint = {
    x: gameState.player.position.x,
    z: gameState.player.position.z,
    rotation: gameState.player.rotation.y,
  };
  if (
    !newest ||
    Math.hypot(playerPoint.x - newest.x, playerPoint.z - newest.z) >= 0.045
  )
    mayorPrologueTrail.push(playerPoint);
  if (mayorPrologueTrail.length > 260) mayorPrologueTrail.shift();
}

function sampleMayorPrologueTrail(distanceBehind: number) {
  if (!mayorPrologueTrail.length) return null;
  let remaining = distanceBehind;
  for (let i = mayorPrologueTrail.length - 1; i > 0; i--) {
    const newer = mayorPrologueTrail[i];
    const older = mayorPrologueTrail[i - 1];
    const segment = Math.hypot(newer.x - older.x, newer.z - older.z);
    if (segment >= remaining) {
      const t = segment > 0 ? remaining / segment : 0;
      return {
        x: THREE.MathUtils.lerp(newer.x, older.x, t),
        z: THREE.MathUtils.lerp(newer.z, older.z, t),
        rotation: newer.rotation,
      };
    }
    remaining -= segment;
  }
  return mayorPrologueTrail[0];
}

function characterGroundY(mapName: string, x: number, z: number) {
  if (mapName === "livingArea") return groundY(x, z);
  if (mapName === "port") return portGroundY(x, z);
  if (mapName === "oldVillage")
    return oldVillageGroundY(x, z) + (isOnOldVillageStair(x, z) ? 0.18 : 0.03);
  if (mapName === "mountain")
    return mountainGroundY(x, z) + (isOnMountainStair(x, z) ? 0.3 : 0.08);
  return 0;
}

function setSeaVertexColor(
  colors: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
  baseR: number,
  baseG: number,
  baseB: number,
  foamMix: number,
  starlight: number,
) {
  const r = baseR * (1 - foamMix) + foamMix;
  const g = baseG * (1 - foamMix) + foamMix;
  const b = baseB * (1 - foamMix) + foamMix;
  const glow = Math.min(1, starlight * 1.65);
  colors.setXYZ(
    index,
    r + (0.78 - r) * glow,
    g + (0.9 - g) * glow,
    b + (1 - b) * glow,
  );
}

gameState.lastFrame = performance.now();

export function animate(now) {
  requestAnimationFrame(animate);
  if (!gameState.player) return;
  document.body.classList.toggle(
    "cutscene-presentation",
    gameState.cutsceneActive,
  );
  const frameDt = Math.min((now - gameState.lastFrame) / 1000, 0.05);
  gameState.lastFrame = now;
  const dt = isGameplayPaused() ? 0 : frameDt;
  const clockDt = isGameTimePaused() ? 0 : frameDt;
  gameState.effectElapsed += frameDt; // 不受暫停影響，純視覺效果一律吃這個
  if (gameState.titlePresentationActive) {
    // 標題展示採現實 1 秒＝遊戲世界 1 秒，只更新天體時鐘，不觸發跨日玩法副作用。
    gameState.elapsed += frameDt * (dayLength / (24 * 60 * 60));
    updateSeasonAndDate();
  } else {
    updateGameClock(clockDt);
  }
  // 每日 06:00 自動存檔——旗標由 game-clock.ts 的 updateGameClock() 設,
  // 這裡才真的呼叫 saveGame()(game-clock.ts 不能直接呼叫，會跟
  // input-save.ts 形成循環 import，見該檔案註解)。cutsceneActive 期間
  // 延後存檔，避免存到過場演出中途的暫態(船在外海、玩家位置被演出接管
  // 那種狀態)；旗標留著，過場結束後下一幀就會補存。
  if (gameState.pendingAutosave && !gameState.cutsceneActive) {
    saveGame("autosave");
    gameState.pendingAutosave = false;
    console.info(
      `[自動存檔] 已於 06:00 儲存（來源：第 ${getActiveSaveSlot()} 格）`,
    );
  }
  // 天梯閃耀星點——跟 foamMeshes/windowMats 這些其他「登記進陣列、
  // animate() 逐幀處理」的特效同一套慣例。只有站在山之洞第25層時這個
  // 陣列才會有內容(buildMap() 換地圖時會整批清空重灑，見
  // scene-registries.ts 的註解)，其他地圖/樓層是空陣列，這裡不用另外
  // judge currentMapName。每個 phase(材質)各自用不同頻率+相位的
  // sin 波取正、四次方讓亮暗對比更明顯，做出「不同步」的閃爍感，跟
  // scene-sky.ts 星空那套 sparkleMaterials 更新是同一條公式。
  celestialSparkleMaterials.forEach((material, phaseIndex) => {
    const pulse = Math.max(
      0,
      Math.sin(
        gameState.effectElapsed * (1.6 + (phaseIndex % 3) * 0.23) +
          (phaseIndex * Math.PI * 2) / celestialSparkleMaterials.length,
      ),
    );
    material.opacity = 0.08 + Math.pow(pulse, 4) * 0.92;
  });
  gameState.animationFrameCount++;
  const updateWaterSurface = gameState.animationFrameCount % 2 === 0; // 水面維持約 30fps，減少大量頂點運算

  // 搖桿輸入：轉成合成鍵盤事件餵給下面的 `keys` map 跟 input-save.ts 的
  // E 鍵/QTE 監聽，跟玩家實際按鍵盤是同一條路徑(見 gamepad-input.ts)。
  pollGamepad();
  if (!isFirstPersonModeActive()) {
    const rightStickZoom = getGamepadLookInput().y;
    if (Math.abs(rightStickZoom) > 0.08)
      window.dispatchEvent(
        new WheelEvent("wheel", { deltaY: rightStickZoom * frameDt * 360 }),
      );
  }
  syncHeldItemVisual();
  updatePrologueGameplayGate();

  // --- 自由移動：方向鍵給的是速度向量，不是格子跳，可以八方向、可以貼牆滑 ---
  // 序幕演出(cutsceneActive)期間整段跳過：船、下船與村長同行走位都由
  // updatePrologueCutscene() 接管；需要玩家實際操作的教學階段會明確解除鎖定。
  let dx = 0,
    dz = 0;
  if (
    !gameState.cutsceneActive &&
    !isCameraAdjustModeActive()
  ) {
    if (keys["w"] || keys["arrowup"]) dz -= 1;
    if (keys["s"] || keys["arrowdown"]) dz += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (gameState.isSitting || gameState.fishingState !== "idle") {
      // 2026-08-26 改成整個釣魚期間(casting/biting/reeling)都鎖移動，不是
      // 只有 reeling：拋竿之後角色本來就該站定等魚，跟現實釣魚一樣；
      // reeling 期間方向鍵是拉竿抵抗方向的 QTE 輸入(見 input-save.ts 的
      // 專屬 keydown 監聽)，更不該同時讓角色走位，也避免走出水邊誤觸
      // 「離開水邊自動取消」。
      dx = 0;
      dz = 0;
    }
    if (isFirstPersonModeActive() && (dx !== 0 || dz !== 0)) {
      const firstPersonMove = firstPersonMoveVector(dx, dz, getFirstPersonYaw());
      dx = firstPersonMove.x;
      dz = firstPersonMove.z;
    }
    const manualInput = Math.hypot(dx, dz) > 0;
    if (manualInput) cancelPlayerNavigation();
    else if (!gameState.isSitting && gameState.fishingState === "idle") {
      const autoDirection = getAutoMoveDirection();
      if (autoDirection) { dx = autoDirection.x; dz = autoDirection.z; }
    }
    const inputLen = Math.hypot(dx, dz);
    // dt===0 代表對話開著／遊戲暫停：主角完全鎖住，不只是不移動位置，
    // 也不能轉向、不能播走路動畫——不然按方向鍵角色會原地轉圈或踏步。
    gameState.isMoving = inputLen > 0 && dt > 0;
    if (inputLen > 0) {
      dx /= inputLen;
      dz /= inputLen;
    }

    const moveSpeed = 15; // 格/秒
    const stepX = dx * moveSpeed * dt,
      stepZ = dz * moveSpeed * dt;
    const canTraverseVillageHeight = (fromX, fromZ, toX, toZ) => {
      if (gameState.currentMapName === "oldVillage")
        return (
          Math.abs(
            oldVillageGroundY(toX, toZ) - oldVillageGroundY(fromX, fromZ),
          ) <= 0.7
        );
      if (gameState.currentMapName === "mountain")
        return (
          Math.abs(mountainGroundY(toX, toZ) - mountainGroundY(fromX, fromZ)) <=
          0.7
        );
      if (gameState.currentMapName === "port")
        return (
          Math.abs(portGroundY(toX, toZ) - portGroundY(fromX, fromZ)) <= 0.45
        );
      return true;
    };
    // X / Z 分開檢查碰撞，撞到一個軸還能沿著另一個軸繼續滑，這是「平穩」的關鍵
    const tryX = gameState.player.position.x + stepX;
    if (
      !collidesAt(
        gameState.currentMapName,
        tryX,
        gameState.player.position.z,
      ) &&
      canTraverseVillageHeight(
        gameState.player.position.x,
        gameState.player.position.z,
        tryX,
        gameState.player.position.z,
      )
    )
      gameState.player.position.x = tryX;
    const tryZ = gameState.player.position.z + stepZ;
    if (
      !collidesAt(
        gameState.currentMapName,
        gameState.player.position.x,
        tryZ,
      ) &&
      canTraverseVillageHeight(
        gameState.player.position.x,
        gameState.player.position.z,
        gameState.player.position.x,
        tryZ,
      )
    )
      gameState.player.position.z = tryZ;

    if (gameState.isMoving && !isFirstPersonModeActive()) {
      // 角色模型的鼻子／腮紅在本地 -Z 面，因此移動方向要比「+Z 為正面」
      // 的通用公式多轉半圈；否則臉會永遠朝向來時路。
      const targetAngle = Math.atan2(dx, dz) + Math.PI;
      gameState.player.rotation.y +=
        (((targetAngle - gameState.player.rotation.y + Math.PI * 3) %
          (Math.PI * 2)) -
          Math.PI) *
        0.35;
      gameState.facing =
        Math.abs(dx) > Math.abs(dz)
          ? dx > 0
            ? "right"
            : "left"
          : dz > 0
            ? "down"
            : "up";
    }
  } else {
    updatePrologueCutscene(dt);
  }
  if (!gameState.cutsceneActive) updatePrologueCutscene(dt);
  if (gameState.isSitting) animateSit(gameState.player);
  // 室內與礦坑會暫停世界時間(gameState.elapsed)，但玩家仍能在場景內移動。
  // 走路若使用世界時間當相位，就會只平移、不擺手腳；視覺動畫改讀持續前進
  // 的 effectElapsed。是否播放仍由 isMoving 決定，選單／對話 dt=0 時不會踏步。
  else
    animateRun(gameState.player, gameState.isMoving, gameState.effectElapsed);
  // 2026-08-26 第六輪反饋「主角剛落地是陷進碼頭的」——animateRun()/
  // animateSit() 剛剛那行會直接覆寫 position.y 成走路/待機用的 bob 值，
  // 序幕在 updatePrologueCutscene() 裡辛苦算出來的甲板/跳板/碼頭高度
  // 因此每幀都被蓋掉，看起來像整段演出都陷進場景。這裡蓋回去，是
  // no-op 除非 cutsceneActive 為真，見 prologue.ts 的
  // reapplyProloguePlayerY() 註解。
  reapplyProloguePlayerY();
  // 序幕演出期間 Y 高度完全由 updatePrologueCutscene() 自己決定(甲板/
  // 跳板斜度都不是地形高度)，這裡跳過地形疊加，避免被拉回海平面/碼頭高度。
  if (!gameState.cutsceneActive) {
    gameState.player.position.y += characterGroundY(
      gameState.currentMapName,
      gameState.player.position.x,
      gameState.player.position.z,
    );
  }
  const mountainStairVisibilityZone =
    gameState.currentMapName === "mountain" &&
    [LAYOUT.mountain.lowerStair, LAYOUT.mountain.upperStair].some(
      (stair) =>
        gameState.player.position.x >= stair.x - 0.5 &&
        gameState.player.position.x <= stair.x + stair.width - 0.5 &&
        gameState.player.position.z >= stair.fromZ - 0.85 &&
        gameState.player.position.z <= stair.toZ + 0.5,
    );
  gameState.player.traverse((child: any) => {
    if (!child.isMesh) return;
    child.renderOrder =
      gameState.currentMapName === "oldVillage"
        ? 3
        : mountainStairVisibilityZone
          ? 10
          : 0;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      material.depthTest = !mountainStairVisibilityZone;
      material.depthWrite = !mountainStairVisibilityZone;
    });
  });

  // 拋竿/持竿動畫：雙手一起蓋過 animateWalk 剛設好的角度。左手往內、往前
  // 擺，靠到跟右手（拿竿那手）差不多的位置跟角度，用兩隻手臂同一個朝向
  // 湊出「雙手握竿」的視覺，不用真的把竿子綁定在兩個支點上
  if (gameState.elapsed < gameState.castAnimEnd) {
    const progress =
      1 - (gameState.castAnimEnd - gameState.elapsed) / CAST_ANIM_DURATION;
    // 先向後（+Z）短暫蓄力，再加速往角色正面（-Z）甩出，最後銜接持竿姿勢。
    // 玩家面朝 -Z；正角度向前、负角度向后。甩竿依次为：
    // 前上预备 → 后上蓄力 → 前方甩出，避免从下方绕圈像往地面挥竿。
    const smooth = (t) => t * t * (3 - 2 * t);
    const mix = (from, to, t) => from + (to - from) * smooth(t);
    const castPose =
      progress < 0.25
        ? mix(0.55, 0.95, progress / 0.25)
        : progress < 0.55
          ? mix(0.95, -1.05, (progress - 0.25) / 0.3)
          : mix(-1.05, 1.15, (progress - 0.55) / 0.45);
    gameState.player.parts.armR.rotation.x = castPose;
    gameState.player.parts.armR.rotation.z = 0;
    gameState.player.parts.armL.rotation.x = castPose * 0.91;
    gameState.player.parts.armL.rotation.z = 0.45;
  } else if (
    gameState.fishingState !== "idle" &&
    gameState.player.parts.rod &&
    gameState.player.parts.rod.visible
  ) {
    // 拋竿動畫結束後，站著等魚上鉤時雙手固定在持竿姿勢，不要被待機呼吸動畫拉回去
    gameState.player.parts.armR.rotation.x = 1.15;
    gameState.player.parts.armR.rotation.z = 0;
    gameState.player.parts.armL.rotation.x = 1.05;
    gameState.player.parts.armL.rotation.z = 0.45;
  } else if (gameState.player.userData?.holdingItem) {
    gameState.player.parts.armL.rotation.x = HELD_ARM_ROTATION.x;
    gameState.player.parts.armR.rotation.x = HELD_ARM_ROTATION.x;
    gameState.player.parts.armL.rotation.z = HELD_ARM_ROTATION.leftZ;
    gameState.player.parts.armR.rotation.z = HELD_ARM_ROTATION.rightZ;
  } else {
    gameState.player.parts.armL.rotation.z = 0; // 沒在釣魚時把左手歸零，不然會卡在往內擺的角度
  }

  // 釣到魚的小動畫：魚從浮標的位置，沿著拋物線飛向玩家，邊飛邊轉，
  // 飛到定點就消失——「消失」代表放進魚簍了，不需要額外的收納動畫
  if (gameState.catchAnim) {
    const t =
      (gameState.elapsed - gameState.catchAnim.start) /
      gameState.catchAnim.duration;
    if (t >= 1) {
      scene.remove(gameState.catchAnim.mesh);
      gameState.catchAnim = null;
    } else {
      const toX = gameState.player.position.x,
        toZ = gameState.player.position.z,
        toY = 0.9;
      const x =
        gameState.catchAnim.from.x + (toX - gameState.catchAnim.from.x) * t;
      const z =
        gameState.catchAnim.from.z + (toZ - gameState.catchAnim.from.z) * t;
      const y =
        gameState.catchAnim.from.y +
        (toY - gameState.catchAnim.from.y) * t +
        Math.sin(t * Math.PI) * 0.85;
      gameState.catchAnim.mesh.position.set(x, y, z);
      gameState.catchAnim.mesh.rotation.y = gameState.elapsed * 11;
      gameState.catchAnim.mesh.rotation.z = gameState.elapsed * 7;
      gameState.catchAnim.mesh.scale.setScalar(1.7 * (1 - t * 0.5));
    }
  }

  // 木材/石頭採集點的木屑/碎石飛散：跟上面 catchAnim 同一種「拋物線+旋轉+
  // 縮小後消失」演出，差別是這裡一次可能好幾片同時飛，用陣列+filter 逐幀
  // 更新／回收，不用像 catchAnim 只認一個 in-flight 物件。
  if (gameState.gatherChipAnims.length) {
    gameState.gatherChipAnims = gameState.gatherChipAnims.filter((chip) => {
      const t = (gameState.elapsed - chip.start) / chip.duration;
      if (t >= 1) {
        scene.remove(chip.mesh);
        return false;
      }
      chip.mesh.position.x += chip.vx * dt;
      chip.mesh.position.z += chip.vz * dt;
      chip.vy -= 3.2 * dt; // 簡單重力，不用真的物理系統
      chip.mesh.position.y += chip.vy * dt;
      chip.mesh.rotation.x += dt * 9;
      chip.mesh.rotation.y += dt * 6;
      chip.mesh.scale.setScalar(1 - t * 0.6);
      return true;
    });
  }

  // --- 釣魚狀態機推進：casting 計時到了就進 biting，biting 逾時沒按 E 就跑掉 ---
  const fishHintEl =
    (window as any).__fishHintEl ||
    ((window as any).__fishHintEl = document.getElementById("fishHint"));
  const fishActionHudEl =
    (window as any).__fishActionHudEl ||
    ((window as any).__fishActionHudEl =
      document.getElementById("fishActionHud"));
  const fishActionKeyEl =
    (window as any).__fishActionKeyEl ||
    ((window as any).__fishActionKeyEl =
      document.getElementById("fishActionKey"));
  if (
    !nearWater() &&
    (gameState.fishingState === "casting" ||
      gameState.fishingState === "biting")
  ) {
    // 走離水邊自動取消——但拉扯期(reeling)不取消，正在跟魚角力時腳下
    // 站的位置不該影響(而且 reeling 期間移動鍵本身已經被鎖住，走不了)，
    // 也避免玩家為了瞄魚的逃跑方向按鍵反而誤觸整組作廢。casting/biting
    // 這兩個「還沒真的上鉤」的階段才需要這條，跟原本行為一致。
    gameState.fishingState = "idle";
    gameState.pendingFishTier = null;
    if (gameState.bobberMesh) {
      scene.remove(gameState.bobberMesh);
      gameState.bobberMesh = null;
    }
    if (gameState.player.parts.rod) gameState.player.parts.rod.visible = false;
  }
  if (gameState.fishingState === "casting") {
    gameState.fishingTimer += dt;
    if (gameState.fishingTimer >= gameState.biteWaitTime) {
      gameState.fishingState = "biting";
      gameState.biteWindowStart = gameState.elapsed;
      // 咬鉤這一刻就把魚階抽出來定案，等玩家按 E 決定是否進入拉扯期。
      gameState.pendingFishTier = isPrologueFishingTutorialActive()
        ? FISH_TIERS.small
        : rollFishTier();
      // 2026-08-26 上鉤提示要「大震動大音效」——咬鉤窗只有 1.1 秒，
      // 用最強的震動強度(見 gamepad-haptics.ts 的 FISHING_HAPTICS.bite)
      // 搭一顆比拋竿/收竿更突兀的音效(見 sfx.ts 的 FISH_BITE_SFX 註解，
      // 音量已經是全域最大值 SFX_VOLUME=1.0，靠換音效而不是調音量做到
      // 「更大聲」)，讓玩家不用盯著螢幕文字也能立刻反應過來。
      vibrateGamepad(FISHING_HAPTICS.bite);
      playRandomSfx(FISH_BITE_SFX);
    }
  } else if (gameState.fishingState === "biting") {
    if (gameState.elapsed - gameState.biteWindowStart > 1.1) {
      gameState.fishingState = "idle";
      gameState.pendingFishTier = null;
      if (gameState.bobberMesh) {
        scene.remove(gameState.bobberMesh);
        gameState.bobberMesh = null;
      }
      if (gameState.player.parts.rod)
        gameState.player.parts.rod.visible = false;
      gameState.fishFeedback = {
        text: "牠跑掉了……",
        until: gameState.elapsed + 1.2,
      };
      if (isPrologueFishingTutorialActive()) reportPrologueFishingFailure();
    }
  } else if (gameState.fishingState === "reeling" && gameState.fishingQte) {
    advanceFishingQte();
  }
  if (gameState.bobberMesh) {
    // 玩家模型正面是本地 -Z；浮標必須沿真正的臉朝向拋出。
    const forwardX = -Math.sin(gameState.player.rotation.y),
      forwardZ = -Math.cos(gameState.player.rotation.y);
    gameState.bobberMesh.position.set(
      gameState.player.position.x + forwardX * 0.85,
      0.16 +
        (gameState.fishingState === "biting"
          ? Math.abs(Math.sin(gameState.elapsed * 14)) * 0.05
          : Math.sin(gameState.elapsed * 2) * 0.015),
      gameState.player.position.z + forwardZ * 0.85,
    );
  }
  if (gameState.fishFeedback) {
    const feedback = gameState.fishFeedback;
    feedback.shownAtMs ??= performance.now();
    // 序章釣魚成功後會暫停遊戲時間並立刻換圖；只看 elapsed 時提示會永遠
    // 不到期。真實時間上限同時保護一般暫停、對話與載入中的提示生命週期。
    const exceededWallClockLimit =
      performance.now() - feedback.shownAtMs >= 2200;
    if (gameState.elapsed > feedback.until || exceededWallClockLimit)
      gameState.fishFeedback = null;
  }
  if (gameState.fishFeedback) {
    fishHintEl.textContent = gameState.fishFeedback.text;
    fishHintEl.style.display = "block";
  } else if (gameState.fishingState === "casting") {
    fishHintEl.textContent = translateText("拋竿中……");
    fishHintEl.style.display = "block";
  } else {
    fishHintEl.style.display = "none";
  }
  // 釣魚 QTE 浮動 HUD——biting(按 E 收竿)/reeling(方向對抗)這兩個
  // 「要馬上按鍵」的狀態改成貼在主角頭頂的單一按鍵提示(取代原本
  // #fishHint 的整句文字，見 index.html/style.css 的 #fishActionHud 註解)，
  // 跟上面的 #fishHint 互斥——同一時間只會有一邊在畫面上。
  if (
    gameState.fishingState === "biting" ||
    (gameState.fishingState === "reeling" && gameState.fishingQte)
  ) {
    FISH_HUD_PROJECT_VEC.set(
      gameState.player.position.x,
      gameState.player.position.y + 1.75,
      gameState.player.position.z,
    ).project(camera);
    const screenX = (FISH_HUD_PROJECT_VEC.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-FISH_HUD_PROJECT_VEC.y * 0.5 + 0.5) * window.innerHeight;
    fishActionHudEl.style.left = `${screenX}px`;
    fishActionHudEl.style.top = `${screenY}px`;

    if (gameState.fishingState === "biting") {
      fishActionKeyEl.textContent = "E";
      fishActionKeyEl.classList.remove("warn");
    } else {
      const qte = gameState.fishingQte!;
      const event = qte.sequence[qte.index];
      if (event.kind === "rush") {
        // 暴衝事件正確動作是「別按任何鍵」(見設計筆記 3.5 節)，用警示配色
        // 的文字取代方向鍵符號，一眼看出跟平常「按對應方向」不一樣。
        fishActionKeyEl.textContent = translateText("別按！");
        fishActionKeyEl.classList.add("warn");
      } else {
        const ARROW: Record<string, string> = {
          up: "↑",
          down: "↓",
          left: "←",
          right: "→",
        };
        const counterDir = COUNTER_DIRECTION[event.fishDirection!];
        fishActionKeyEl.textContent = ARROW[counterDir];
        fishActionKeyEl.classList.remove("warn");
      }
    }
    fishActionHudEl.style.display = "block";
  } else {
    fishActionHudEl.style.display = "none";
  }

  // --- 牡蠣架收成回饋卡：跟上面 fishHint 同一招，gameState.harvestFeedback
  // 到期(elapsed > until)就清掉，這裡只負責把目前狀態同步到 DOM ---
  const harvestToastEl =
    (window as any).__harvestToastEl ||
    ((window as any).__harvestToastEl =
      document.getElementById("harvestToast"));
  const harvestToastTitleEl =
    (window as any).__harvestToastTitleEl ||
    ((window as any).__harvestToastTitleEl =
      document.getElementById("harvestToastTitle"));
  const harvestToastTextEl =
    (window as any).__harvestToastTextEl ||
    ((window as any).__harvestToastTextEl =
      document.getElementById("harvestToastText"));
  if (gameState.harvestFeedback) {
    const feedback = gameState.harvestFeedback;
    feedback.shownAtMs ??= performance.now();
    const exceededWallClockLimit =
      performance.now() - feedback.shownAtMs >= 3500;
    if (gameState.elapsed > feedback.until || exceededWallClockLimit)
      gameState.harvestFeedback = null;
  }
  if (gameState.harvestFeedback) {
    const fb = gameState.harvestFeedback;
    harvestToastTitleEl.textContent = fb.title;
    harvestToastTextEl.textContent = fb.text;
    harvestToastEl.classList.toggle("harvestToast--empty", fb.kind === "empty");
    harvestToastEl.classList.add("show");
  } else {
    harvestToastEl.classList.remove("show");
  }

  // 牡蠣架的殼——還沒採的時候用 emissiveIntensity 做一個緩慢的呼吸式發光
  // (跟窗戶/桌燈那種靠 nightFactor 開關的 emissive 不同，這裡不分晝夜、
  // 純粹用 elapsed 算正弦波)，提醒玩家「這裡今天還能採」；採完(或還沒
  // 建好/切到別的地圖時材質清單是空的就直接歸零，跟
  // 其他殼一樣暗下來，一眼能分辨今天巡過了沒。
  gameState.oysterGlowMats.forEach((material, index) => {
    material.emissiveIntensity = isOysterRackReady(index)
      ? 0.45 + Math.sin(gameState.elapsed * 2.4) * 0.3
      : 0;
  });

  // 採集點只在真正切換地圖時刷新；留在原地跨過 06:00／18:00 時，畫面與
  // 採集狀態都維持不變，避免木材／石頭在玩家眼前突然搬動或重生。
  const gatherNodes = [...WOOD_NODES, ...STONE_NODES];
  gatherNodeMeshes.forEach((entry) => {
    const node = gatherNodes.find((candidate) => candidate.id === entry.nodeId);
    if (!node) {
      entry.group.visible = false;
      return;
    }
    entry.group.position.set(
      node.x,
      entry.map === "mountain" ? mountainGroundY(node.x, node.z) : 0,
      node.z,
    );
    entry.group.visible = !node.collected;
  });
  flowerNodeMeshes.forEach((entry) => {
    const node = FLOWER_NODES.find((candidate) => candidate.id === entry.nodeId);
    if (!node) {
      entry.group.visible = false;
      return;
    }
    entry.group.position.set(
      node.x,
      entry.map === "mountain" ? mountainGroundY(node.x, node.z) : 0,
      node.z,
    );
    entry.group.visible = !node.collected;
  });
  mushroomNodeMeshes.forEach((entry) => {
    const node = MUSHROOM_NODES.find((candidate) => candidate.id === entry.nodeId);
    if (!node) {
      entry.group.visible = false;
      return;
    }
    entry.group.position.set(
      node.x,
      entry.map === "mountain" ? mountainGroundY(node.x, node.z) : 0,
      node.z,
    );
    entry.group.visible = !node.collected;
  });

  // 格子座標現在只是「玩家四捨五入後大概在哪一格」，給種田/撿種子/開門這些
  // 本來就是格子概念的系統用，跟移動本身脫鉤
  // 對話開著的時候整段跳過：主角位置雖然被鎖住(dt=0)不會再移動，但如果
  // E 鍵開對話那一刻角色剛好卡在格線中間(還沒 round 穩定)，下一幀四捨
  // 五入結果可能剛好翻過門檻格，誤觸 touch 事件(例如衝進房子/切地圖)，
  // 對話框卻還開著——曾經真的遇到這個 bug，玩家會卡在錯的地圖裡動不了。
  if (!dialogQueue.length && !isInventoryOpen()) {
    const roundedX = Math.round(gameState.player.position.x),
      roundedZ = Math.round(gameState.player.position.z);
    if (
      roundedX !== gameState.playerGridPos.x ||
      roundedZ !== gameState.playerGridPos.z
    ) {
      gameState.playerGridPos = { x: roundedX, z: roundedZ };
      // 開發模式限定：每移動一格印一次目前地圖+座標，方便對照地圖切換
      // 門檻座標清單，用肉眼確認有沒有真的走到門檻附近。跟其他開發用
      // console 訊息一樣，production build 這個 if 整塊會被靜態消掉。
      if (import.meta.env.DEV) {
        console.log(`[${gameState.currentMapName}] (${roundedX},${roundedZ})`);
      }
      // 2026-08-26 Zeppelin 反饋「木匠事件因為只做了範圍觸發導致也會
      // 發生」——木匠碼頭事件(build-map.ts 的 carpenterMeet 矩形區)
      // 跟其他地圖上的 touch 事件一樣，只認「玩家格子座標有沒有進入
      // 觸發區」，不管這個座標是 WASD 走過去的還是序幕自己直接寫
      // position 搬過去的；序幕(第一天演出)下船走位剛好會經過港口的
      // 觸發格，於是木匠事件在演出途中被意外觸發，兩段對話疊在一起。
      // 用跟其他地方同一支旗標擋掉：cutsceneActive 為真時，代表玩家
      // 位置目前是被某段演出(目前只有序幕)直接控制，不該讓任何 touch
      // 事件跟著誤觸發。
      if (
        !gameState.cutsceneActive &&
        !isPrologueFarmingActive() &&
        !isPrologueFishingTutorialActive() &&
        !isPrologueCookingTutorialActive()
      ) {
        events
          .filter(
            (ev) =>
              ev.map === gameState.currentMapName && ev.trigger === "touch",
          )
          .filter((ev) => ev.x === roundedX && ev.z === roundedZ)
          .forEach((ev) => ev.action());
      }
    }
  }

  const phase = gameState.currentPhase;

  // --- NPC：先看行程表要去哪，再用 A* 決定「怎麼走」 ---
  const npcSpeed = 1.6;
  updateCarpenterEscortTrail();
  updateMayorPrologueTrail();

  // 第二天 08:00-08:30 強制觸發，不管玩家人在哪張地圖/哪個位置——跟下面
  // isPrologueSeekingRod() 那個「玩家主動靠近船長」的觸碰式判斷不同款，
  // 見 day2-morning-event.ts 檔頭註解。
  if (canStartDayTwoMorningEvent()) {
    startDayTwoMorningEvent();
  }

  if (
    isPrologueSeekingRod() &&
    gameState.currentMapName === "port" &&
    Math.hypot(
      gameState.player.position.x - PROLOGUE_CAPTAIN_X,
      gameState.player.position.z - PROLOGUE_CAPTAIN_Z,
    ) <= 4.2
  ) {
    startPrologueFishingSequence();
  }

  npcs.forEach((n) => {
    // Story NPCs may intentionally retain only an empty compatibility node.
    if (n.mesh.parts == null) {
      n.mesh.visible = false;
      return;
    }
    // 第二天早上劇本——村長在家門口等玩家、之後港口迎接歐文/露比，
    // 都是同一組「固定站位」機制：holdPositions 有這個 npc id 的
    // entry、而且目前地圖跟 holdMap 相符，就整段接管，不讓下面的日常
    // 行程表(getScheduleTarget)/escort 機制把它重新接手。原本只認
    // 「mayor + livingArea」寫死一組，2026-09-02 第二輪劇本擴充成
    // 港口三人同時固定站位後，改成看 day2-morning-event.ts 自己維護的
    // 那份表，站位資料/朝向都由呼叫端決定，這裡只負責套用。跟
    // isCarpenterWaitingAtHouse 那段（更下面）是同一種「固定站位」
    // 寫法的另一個例子。
    if (
      dayTwoMorningEvent.holding &&
      dayTwoMorningEvent.holdMap === gameState.currentMapName &&
      dayTwoMorningEvent.holdPositions?.[n.id]
    ) {
      const hold = dayTwoMorningEvent.holdPositions[n.id];
      npcGroup.visible = true;
      n.mesh.visible = true;
      n.mesh.position.x = hold.x;
      n.mesh.position.z = hold.z;
      n.mesh.rotation.y = hold.rotY;
      // 2026-09-02 修正：animateWalk() 對「原地不動」的情況會把
      // position.y 整個覆蓋成微小的待機彈跳量(見 humanoid.ts
      // animateWalk 的 moving=false 分支，不是疊加)，所以地形高度
      // 一定要在呼叫 animateWalk() 之後再設，順序跟上面
      // isPrologueMayorFollowing、下面 escort trail 那兩段完全一樣。
      // 原本寫反了，導致村長固定站位時整個人半沉進地板——上一輪
      // Zeppelin 回報「村長出現在地面底下」就是這裡，這裡保留修正過
      // 的順序。
      animateWalk(n.mesh, false, gameState.elapsed);
      n.mesh.position.y = characterGroundY(
        dayTwoMorningEvent.holdMap,
        hold.x,
        hold.z,
      );
      return;
    }
    if (isPrologueMayorFollowing() && n.id === "mayor") {
      const trailPoint = sampleMayorPrologueTrail(0.72);
      if (trailPoint) {
        const moved = Math.hypot(
          trailPoint.x - n.mesh.position.x,
          trailPoint.z - n.mesh.position.z,
        );
        npcGroup.visible = true;
        n.mesh.visible = true;
        n.mesh.position.x = trailPoint.x;
        n.mesh.position.z = trailPoint.z;
        n.mesh.rotation.y = trailPoint.rotation;
        animateWalk(n.mesh, moved > 0.008, gameState.effectElapsed);
        n.mesh.position.y = characterGroundY(
          gameState.currentMapName,
          trailPoint.x,
          trailPoint.z,
        );
      }
      return;
    }
    // 序章期間村長與船長的位置由 prologue.ts 完整控制，不能再讓日常
    // 排程於同一幀覆寫，否則船長會瞬移或偏離下船路線。
    if (
      (gameState.cutsceneActive ||
        isPrologueFarmingActive() ||
        isPrologueSeekingRod() ||
        isPrologueFishingTutorialActive()) &&
      (n.id === "mayor" || n.id === "captain")
    )
      return;
    const isCarpenterEscortActor =
      (carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
      (n.id === "mayor" || n.id === "carpenter");
    const isCarpenterWaitingAtHouse =
      (carpenterQuest.stage === "construction" ||
        carpenterQuest.stage === "ready_for_move_in") &&
      n.id === "carpenter";
    if (
      (isCarpenterEscortActor || isCarpenterWaitingAtHouse) &&
      (gameState.currentMapName === "port" ||
        gameState.currentMapName === "oldVillage") &&
      (n.id === "mayor" || n.id === "carpenter")
    ) {
      if (
        (carpenterQuest.stage === "village_scene_done" ||
          carpenterQuest.stage === "construction" ||
          carpenterQuest.stage === "ready_for_move_in") &&
        gameState.currentMapName === "oldVillage" &&
        n.id === "carpenter"
      ) {
        n.mesh.visible = true;
        n.mesh.position.set(
          CARPENTER_EVENT_WAIT_POS.x,
          characterGroundY(
            "oldVillage",
            CARPENTER_EVENT_WAIT_POS.x,
            CARPENTER_EVENT_WAIT_POS.z,
          ),
          CARPENTER_EVENT_WAIT_POS.z,
        );
        animateWalk(n.mesh, false, gameState.elapsed);
        return;
      }
      const trailPoint = sampleCarpenterEscortTrail(
        n.id === "mayor" ? 0.72 : 1.42,
      );
      if (!trailPoint) return;
      const moved = Math.hypot(
        trailPoint.x - n.mesh.position.x,
        trailPoint.z - n.mesh.position.z,
      );
      n.mesh.position.x = trailPoint.x;
      n.mesh.position.z = trailPoint.z;
      n.mesh.rotation.y = trailPoint.rotation;
      const moving = moved > 0.008;
      // animateWalk 會把 position.y 整個蓋成「原地踏步」的小幅彈跳量
      // （不是疊加），所以地形高度一定要在呼叫它之後再加回去——跟主角
      // 那邊 animateRun() 先跑、才 += characterGroundY() 的順序完全一樣；
      // 順序顛倒的話這裡剛算好的地形高度下一行就會被彈跳量整個蓋掉。
      animateWalk(n.mesh, moving, gameState.elapsed);
      n.mesh.position.y += characterGroundY(
        gameState.currentMapName,
        trailPoint.x,
        trailPoint.z,
      );
      return;
    }
    if (!n.mesh.visible) return; // 木匠抵達前先不跑排程/路徑，省得算假人的路
    if (n.map !== gameState.currentMapName) return;
    const target = getScheduleTarget(n.schedule, phase);
    const targetKey = `${target.x},${target.z}`;

    if (n.lastTargetKey !== targetKey) {
      n.lastTargetKey = targetKey;
      const startGrid = {
        x: Math.round(n.mesh.position.x),
        z: Math.round(n.mesh.position.z),
      };
      const activeMap = MAPS[gameState.currentMapName];
      const path = aStar(
        startGrid,
        target,
        activeMap.tiles[0].length,
        activeMap.tiles.length,
        (x, z) => isBlocked(gameState.currentMapName, x, z),
      );
      n.path = path && path.length ? path : [target]; // 找不到路就退回直線，至少不會卡死
      n.pathIndex =
        n.path[0] && n.path[0].x === startGrid.x && n.path[0].z === startGrid.z
          ? 1
          : 0;
    }

    let moving = false;
    if (n.path && n.pathIndex < n.path.length) {
      const wp = n.path[n.pathIndex];
      const dx = wp.x - n.mesh.position.x,
        dz = wp.z - n.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.06) {
        moving = true;
        const step = Math.min(dist, npcSpeed * dt);
        n.mesh.position.x += (dx / dist) * step;
        n.mesh.position.z += (dz / dist) * step;
        // NPC 與玩家使用同一種人形模型，正面同樣朝本地 -Z。
        n.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
      } else {
        n.pathIndex++;
      }
    }
    // 2026-08-26：Zeppelin 反饋船長常常背對鏡頭看不到臉——他的巡邏
    // 範圍很小(見 npc-defs.ts 的 CAPTAIN_STAND_X/Z)，站定不動時的朝向
    // 是「上一段走過來的方向」凍結住的，不同時段回到 home 點時朝向會
    // 不一樣，兩種都可能背對玩家。與其硬轉 180(只解一種情況)，直接把
    // 這段「玩家靠近時緩慢轉向玩家」的既有邏輯從只認 livingArea 擴大
    // 到 port 也適用——之後 port 地圖上其他站定的 NPC 一樣受惠，不用
    // 每個角色各自修。
    if (
      !moving &&
      (gameState.currentMapName === "livingArea" ||
        gameState.currentMapName === "port")
    ) {
      const pdx = gameState.player.position.x - n.mesh.position.x,
        pdz = gameState.player.position.z - n.mesh.position.z;
      if (Math.sqrt(pdx * pdx + pdz * pdz) <= 4) {
        const targetAngle = Math.atan2(pdx, pdz) + Math.PI;
        n.mesh.rotation.y +=
          (((targetAngle - n.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) -
            Math.PI) *
          0.05;
      }
    }
    // 跟上面 escort 分支同理：animateWalk 會蓋掉 position.y，地形高度要在
    // 呼叫它之後再疊加回去，不能先設好高度再讓 animateWalk 蓋掉。
    animateWalk(n.mesh, moving, gameState.elapsed);
    n.mesh.position.y += characterGroundY(
      gameState.currentMapName,
      n.mesh.position.x,
      n.mesh.position.z,
    );
  });

  // 日照、天空、燈光與星象共用同一個依季節日出日落計算的夜色權重。
  const nightFactor = getNightFactor(phase);
  (window as any).__nightFactor = nightFactor;
  // 這四個都是純演出/氣氛效果，故意傳 frameDt(真實時間)而不是 dt——
  // 對話開啟時遊戲時鐘跟主角動作凍結，但音樂淡入淡出、流星、天氣粒子
  // 不該跟著卡住，繼續播才像「世界還活著」而不是整個遊戲暫停。
  updateMusic(nightFactor, frameDt);
  // 星空、日月、雲與天空球都要使用最後真正送進 renderer 的相機。
  updateFirstPersonCamera(frameDt);
  updateSkyDome(nightFactor, getGameplayCamera(camera));
  updateMeteors(frameDt);
  updateWeatherEffects(frameDt, nightFactor);

  // --- 動物固定作息：08:00 出門，17:00 開始回穀倉；惡劣天氣全天留在小屋。 ---
  // 不使用 nightFactor 判斷，因為它是光線漸變值，不等於準確鐘點。
  const gameHour = phase * TIME_CONFIG.gameHoursPerDay;
  const animalsShouldBeHome =
    gameHour < 8 || gameHour >= 17 || isUnsafeAnimalWeather();
  // 20:00 備援：地形複雜導致直線走不到門口時，強制送回穀倉，避免整夜卡在戶外。
  const forceAnimalsHome = gameHour >= 20 || isUnsafeAnimalWeather();

  // --- 動物投餵機／放牧結算：10:00 結算放牧，17:00 結算投餵機。---
  // 用 SettledDay 記錄「這天結算過了嗎」，避免同一天內每一幀都重算；
  // 跟 beginNewDay() 那套「跨日事件」不同層級，這裡是同一天內的鐘點事件，
  // 快轉跳過整天時可能漏掉中間天數的結算，跟 animalsShouldBeHome 一樣
  // 只認目前這一刻的 gameHour，是同一種簡化(見 AGENTS.md 對這塊的說明)。
  if (
    gameHour >= 10 &&
    gameState.pastureGrazeSettledDay !== gameState.currentDay
  ) {
    gameState.pastureGrazeSettledDay = gameState.currentDay;
    gameState.pastureGrazedToday = settlePastureGrazing(gameState.currentDay);
  }
  if (gameHour >= 17 && gameState.feederSettledDay !== gameState.currentDay) {
    gameState.feederSettledDay = gameState.currentDay;
    const fed =
      gameState.pastureGrazedToday || settleFeederConsumption();
    recordAnimalFeedingDay(gameState.currentDay, fed);
  }

  const animalRadius = (a) =>
    a.type === "cow" ? 0.42 : a.type === "sheep" ? 0.36 : 0.24;
  const isAnimalPositionSafe = (a, x: number, z: number) => {
    const radius = animalRadius(a);
    return ![
      [0, 0],
      [-radius, -radius],
      [radius, -radius],
      [-radius, radius],
      [radius, radius],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
    ].some(([dx, dz]) => isBlocked("livingArea", x + dx, z + dz));
  };
  const chooseSafeAnimalTarget = (a) =>
    chooseAnimalPastureTarget(a, (x, z) => isAnimalPositionSafe(a, x, z));
  const moveAnimalWithCollision = (a, nextX: number, nextZ: number) => {
    const oldX = a.mesh.position.x;
    const oldZ = a.mesh.position.z;
    // 分軸嘗試能讓動物沿牆滑行；兩軸都受阻時本幀不動，下一段邏輯會改目標。
    if (isAnimalPositionSafe(a, nextX, nextZ)) {
      a.mesh.position.x = nextX;
      a.mesh.position.z = nextZ;
    } else if (isAnimalPositionSafe(a, nextX, oldZ)) {
      a.mesh.position.x = nextX;
    } else if (isAnimalPositionSafe(a, oldX, nextZ)) {
      a.mesh.position.z = nextZ;
    }
    return (
      Math.hypot(a.mesh.position.x - oldX, a.mesh.position.z - oldZ) > 1e-6
    );
  };
  const rescueAnimalFromObstacle = (a) => {
    if (isAnimalPositionSafe(a, a.mesh.position.x, a.mesh.position.z)) return;
    // 舊存檔或舊亂數可能已把動物放進建築；找最近的安全點救出，避免永遠卡住。
    const originX = a.mesh.position.x;
    const originZ = a.mesh.position.z;
    for (let ring = 1; ring <= 12; ring++) {
      const radius = ring * 0.25;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const x = originX + Math.cos(angle) * radius;
        const z = originZ + Math.sin(angle) * radius;
        if (!isAnimalPositionSafe(a, x, z)) continue;
        a.mesh.position.x = x;
        a.mesh.position.z = z;
        a.target = chooseSafeAnimalTarget(a);
        a.routeTarget = null;
        a.homePath = null;
        return;
      }
    }
  };

  updateCarriedAnimalPose();
  animals.forEach((a) => {
    if (!gameState.ownedAnimals?.includes(a.id)) {
      a.mesh.visible = false;
      return;
    }
    a.mesh.visible = true;
    if (isAnimalCarried(a.id)) return;
    let moving = false;
    if (a.state === "out") rescueAnimalFromObstacle(a);

    // 20:00 後（或惡劣天氣）仍在外 → 直接進穀倉
    if (forceAnimalsHome && a.state === "out") {
      a.state = "in";
      a.mesh.visible = false;
      a.mesh.position.set(BARN_DOOR.x, 0, BARN_DOOR.z);
      a.target = null;
      a.routeTarget = null;
      a.homePath = null;
      a.wanderState = "resting";
      animateAnimalWalk(a, false, gameState.elapsed);
      return;
    }

    if (animalsShouldBeHome) {
      if (a.state === "out") {
        // 17:00 後不管原本是否正在休息，都立即往穀倉移動。與其用寫死的
        // 中繼點硬轉一段（舊版 BARN_RETURN_APPROACH，一律先繞去
        // (barn.x+w+1, doorZ+2) 才轉向門口），改成跟村民 NPC 排程移動
        // 同一套 aStar()：以動物當下格子為起點、穀倉門口為終點算一次
        // 最短路徑，路徑本身就會繞開小屋牆面/柵欄，不需要動物已經站在
        // 門口附近時還被迫多繞一趟。
        a.wanderState = "walking";
        if (!a.homePath) {
          const startGrid = {
            x: Math.round(a.mesh.position.x),
            z: Math.round(a.mesh.position.z),
          };
          const path = aStar(
            startGrid,
            { x: BARN_DOOR.x, z: BARN_DOOR.z },
            outsideCols,
            outsideRows,
            (x, z) => !isAnimalPositionSafe(a, x, z),
          );
          a.homePath =
            path && path.length ? path : [{ x: BARN_DOOR.x, z: BARN_DOOR.z }];
          a.homePathIndex =
            a.homePath[0] &&
            a.homePath[0].x === startGrid.x &&
            a.homePath[0].z === startGrid.z
              ? 1
              : 0;
        }
        if (a.homePathIndex < a.homePath.length) {
          const wp = a.homePath[a.homePathIndex];
          const dx = wp.x - a.mesh.position.x,
            dz = wp.z - a.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.12) {
            const step = Math.min(dist, a.speed * dt);
            moving = moveAnimalWithCollision(
              a,
              a.mesh.position.x + (dx / dist) * step,
              a.mesh.position.z + (dz / dist) * step,
            );
            // 動物模型的頭朝本地 +X，不是跟角色一樣朝 -Z，所以要多轉 -90°
            a.mesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
          } else {
            a.homePathIndex++;
          }
        } else {
          a.state = "in";
          a.mesh.visible = false;
          a.homePath = null;
          a.homePathIndex = 0;
        }
      }
    } else if (a.state === "in") {
      a.state = "out";
      a.mesh.visible = true;
      a.mesh.position.set(BARN_DOOR.x, 0, BARN_DOOR.z);
      a.homePath = null;
      a.homePathIndex = 0;
      a.target = chooseSafeAnimalTarget(a);
      a.wanderState = "walking";
      a.restUntil = 0;
      a.grazeAt = Infinity;
    } else {
      // 白天不再不停巡邏：抵達目標後先休息，再挑下一個位置。
      if (a.wanderState === "resting") {
        if (gameState.elapsed >= a.restUntil) {
          a.wanderState = "walking";
          a.target = chooseSafeAnimalTarget(a);
          a.grazeAt = Infinity;
        } else if (gameState.elapsed >= a.grazeAt) {
          tryEatPastureGrass(a);
          a.grazeAt = Infinity;
        }
      } else {
        // 每次換新目標(a.target 是全新物件)都重新記錄起點跟總距離，
        // 側向弧度用這隻動物自己的 pathSeed 決定方向、隨距離縮放但封頂，
        // 這樣同一隻動物走去同一叢草，路線也不會每次都是同一條直線。
        if (a.routeTarget !== a.target) {
          a.routeTarget = a.target;
          a.routeFromX = a.mesh.position.x;
          a.routeFromZ = a.mesh.position.z;
          a.routeTotalDist = Math.hypot(
            a.target.x - a.mesh.position.x,
            a.target.z - a.mesh.position.z,
          );
          a.routeCurve =
            (a.pathSeed - 0.5) * Math.min(1.2, a.routeTotalDist) * 0.6;
          a.prevBend = 0;
        }
        const dx = a.target.x - a.mesh.position.x,
          dz = a.target.z - a.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.15) {
          a.wanderState = "resting";
          a.restUntil =
            gameState.elapsed +
            a.restMin +
            Math.random() * (a.restMax - a.restMin);
          a.grazeAt = gameState.elapsed + 0.8;
        } else {
          const progress =
            a.routeTotalDist > 0
              ? Math.min(1, Math.max(0, 1 - dist / a.routeTotalDist))
              : 1;
          const bend = Math.sin(progress * Math.PI) * a.routeCurve;
          const dirX = (a.target.x - a.routeFromX) / (a.routeTotalDist || 1),
            dirZ = (a.target.z - a.routeFromZ) / (a.routeTotalDist || 1);
          const step = Math.min(dist, a.speed * dt);
          const nx =
            a.mesh.position.x + dirX * step - dirZ * (bend - (a.prevBend || 0));
          const nz =
            a.mesh.position.z + dirZ * step + dirX * (bend - (a.prevBend || 0));
          const oldX = a.mesh.position.x,
            oldZ = a.mesh.position.z;
          moving = moveAnimalWithCollision(a, nx, nz);
          const rdx = a.mesh.position.x - oldX,
            rdz = a.mesh.position.z - oldZ;
          if (Math.abs(rdx) > 1e-6 || Math.abs(rdz) > 1e-6)
            a.mesh.rotation.y = Math.atan2(rdx, rdz) - Math.PI / 2;
          if (moving) {
            a.prevBend = bend;
          } else {
            // 彎曲路徑撞上障礙時直接換安全目標，不讓動物持續頂著牆。
            a.target = chooseSafeAnimalTarget(a);
            a.routeTarget = null;
          }
        }
      }
    }
    if (moving) {
      a.stuckSeconds = 0;
    } else if (a.state === "out" && a.wanderState === "walking" && dt > 0) {
      a.stuckSeconds = (a.stuckSeconds || 0) + dt;
      if (a.stuckSeconds >= 2) {
        a.stuckSeconds = 0;
        if (animalsShouldBeHome) {
          a.state = "in";
          a.mesh.visible = false;
          a.mesh.position.set(BARN_DOOR.x, 0, BARN_DOOR.z);
          a.target = null;
          a.routeTarget = null;
          a.homePath = null;
        } else {
          const rescue = randomPasturePoint((x, z) =>
            isAnimalPositionSafe(a, x, z),
          );
          a.mesh.position.set(rescue.x, 0, rescue.z);
          a.target = chooseSafeAnimalTarget(a);
          a.routeTarget = null;
          a.wanderState = "walking";
        }
      }
    } else {
      a.stuckSeconds = 0;
    }
    animateAnimalWalk(a, moving, gameState.elapsed);
  });

  const sky = DAY.sky.clone().lerp(NIGHT.sky, nightFactor);
  // 保留天空、雲與降水的天氣辨識，但不再降低地圖可視度。
  const weatherDim = 0;
  const skyReflectionAlpha =
    ({
      clear: 0.2,
      cloudy: 0.14,
      rain: 0.1,
      typhoon: 0.055,
      storm: 0.045,
      snow: 0.15,
      blizzard: 0.065,
    }[gameState.currentWeather] ?? 0.12) *
    (0.82 + nightFactor * 0.42);
  waterSurfaceMaterials.forEach((material) => {
    // Standard 水面以 emissive 補環境色；港口／城鎮的 Basic 水面不受場景
    // 半球光影響，天空顏色由 planar reflection 本身提供。
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.copy(sky);
      material.emissiveIntensity = skyReflectionAlpha;
    }
  });
  const underwaterSky = sky.clone().multiplyScalar(0.58 + nightFactor * 0.12);
  waterSkyUnderlayMaterials.forEach((material) => {
    material.color.copy(underwaterSky);
    material.emissive.copy(underwaterSky);
    material.emissiveIntensity = 0.28;
  });
  // 渡輪跳板：白天靠港放下，夜間視為已啟航/行駛中，收起跳板。渡輪
  // 本身固定不動，只切換跳板可見度，不需要真的動畫船身進出港。
  const ferryDocked = !isNightTime();
  gangplankMeshes.forEach((mesh) => {
    mesh.visible = ferryDocked;
  });
  // 室內南牆(離攝影機最近那排，見 scene-registries.ts 的
  // southIndoorWallMeshes 說明)——2026-08-27 玩家反饋：標準跟隨鏡頭
  // 底下這排牆整片擋住房間內部看不到裡面，只有 F4 鏡頭調整模式／
  // 第一人稱模式底下才需要看到真正完整的牆。跟上面 gangplankMeshes
  // 同一套「登記進陣列、animate() 逐幀切換 .visible」的慣例，不需要
  // 重新蓋地圖，切鏡頭模式那一幀就會跟著換。
  const standardCameraMode =
    !isFirstPersonModeActive() && !isCameraAdjustModeActive();
  southIndoorWallMeshes.forEach((mesh) => {
    mesh.visible = !standardCameraMode;
  });
  if (isOutdoorMap()) {
    scene.background = sky;
    // 天氣不再縮短戶外可視距離。
    if (true) {
      // 晴天保持高能見度；拉遠時距離霧會讓整座島被天空色洗成白霧。
      scene.fog = null;
    } else {
      const zoomCameraDistanceOffset = Math.max(0, gameState.zoom * 1.55 - 16);
      scene.fog = new THREE.Fog(
        sky,
        16 + zoomCameraDistanceOffset - weatherDim * 5,
        34 + zoomCameraDistanceOffset - weatherDim * 11,
      );
    }
  } else {
    scene.background = INTERIOR_BACKGROUND_COLOR;
    scene.fog = null;
  }
  const daylight = Math.pow(1 - nightFactor, 1.25);
  // 晴朗白天降低 ACES 曝光，保留草地、岩石與建築的色彩層次；
  // 夜間稍微回升，避免星空與燈光變得太暗。
  renderer.toneMappingExposure =
    gameState.currentWeather === "clear" ? 0.76 + nightFactor * 0.26 : 1.02;
  const noonWarmth =
    daylight *
    Math.pow(
      Math.max(0, 1 - Math.abs(gameState.currentPhase - 0.5) / 0.2),
      1.7,
    );
  const fairWeather =
    gameState.currentWeather === "clear" ||
    gameState.currentWeather === "cloudy";
  const summerSun =
    gameState.currentSeason === 1 && fairWeather
      ? daylight * (gameState.currentWeather === "clear" ? 1 : 0.42)
      : 0;
  const autumnWarmth =
    gameState.currentSeason === 2 && fairWeather ? daylight * 0.32 : 0;
  const winterSnowReflection =
    gameState.currentSeason === 3 &&
    (gameState.currentWeather === "snow" ||
      gameState.currentWeather === "blizzard")
      ? (gameState.currentWeather === "snow" ? 0.34 : 0.22) *
        (0.35 + daylight * 0.65)
      : 0;

  ambient.intensity =
    (DAY.ambient + (NIGHT.ambient - DAY.ambient) * nightFactor) *
      (1 - weatherDim * 0.32) +
    summerSun * 0.08 +
    winterSnowReflection * 0.38;
  ambient.color
    .set(0xffffff)
    .lerp(WINTER_AMBIENT_COLOR, winterSnowReflection * 0.8);
  sun.intensity =
    (DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * nightFactor) *
      (1 - weatherDim * 0.72) +
    summerSun * 0.48 +
    autumnWarmth * 0.12 +
    winterSnowReflection * 0.18;
  if (gameState.currentWeather === "clear") {
    // 降低均勻灑滿全場的白光，改由陰影與材質色建立晴天的清晰對比。
    ambient.intensity *= 1 - daylight * 0.22;
    sun.intensity *= 1 - daylight * 0.18;
  }
  sun.color.copy(DAY.sunColor).lerp(NIGHT.sunColor, nightFactor);
  if (summerSun > 0) sun.color.lerp(SUMMER_SUN_COLOR, summerSun * 0.42);
  else if (autumnWarmth > 0) sun.color.lerp(AUTUMN_SUN_COLOR, autumnWarmth);
  else if (winterSnowReflection > 0)
    sun.color.lerp(WINTER_LIGHT_COLOR, winterSnowReflection * 0.75);
  const noonSeasonStrength = [0.3, 0.46, 0.4, 0.16][gameState.currentSeason];
  sun.color.lerp(NOON_WARM_COLOR, noonWarmth * noonSeasonStrength);
  seasonalBounceLight.intensity =
    summerSun * 0.22 + winterSnowReflection * 0.75;
  seasonalBounceLight.color
    .set(0xfff2c7)
    .lerp(WINTER_AMBIENT_COLOR, winterSnowReflection > 0 ? 1 : 0);
  seasonalBounceLight.groundColor
    .copy(SUMMER_BOUNCE_GROUND)
    .lerp(WINTER_BOUNCE_GROUND, winterSnowReflection > 0 ? 1 : 0);
  windowMats.forEach((m) => {
    m.emissiveIntensity = nightFactor;
  });
  outdoorLampLights.forEach((light) => {
    light.intensity = nightFactor * 1.35;
  });
  if (gameState.houseLampLight) {
    gameState.houseLampBulbMat.emissiveIntensity = nightFactor;
    gameState.houseLampLight.intensity = nightFactor * 1.6;
  }
  if (gameState.houseCeilingLampLight) {
    gameState.houseCeilingLampBulbMat.emissiveIntensity = nightFactor;
    gameState.houseCeilingLampLight.intensity = nightFactor * 2.2;
  }

  // 過場鏡頭系統(cutscene-camera.ts)：有排定的鏡頭清單在播，或正處於
  // F4 手動調整模式，這裡回傳的值會取代下面「自動跟玩家/船」的鏡頭
  // 邏輯；兩者都沒有時回傳 null，本幀鏡頭邏輯完全不受影響(既有行為不變)。
  // 過場會讓玩法 dt=0；鏡頭仍必須能播放與手動平移，因此使用不受暫停
  // 影響的 frameDt。滾輪縮放不吃 dt，先前才會出現「能縮放但不能平移」。
  const cameraShotOverride = updateCameraShots(frameDt);
  const cameraAdjustOverride = cameraShotOverride
    ? null
    : updateCameraAdjustMode(
        frameDt,
        Boolean(keys["a"] || keys["arrowleft"]),
        Boolean(keys["d"] || keys["arrowright"]),
        Boolean(keys["w"] || keys["arrowup"]),
        Boolean(keys["s"] || keys["arrowdown"]),
      );
  const cameraOverride = cameraShotOverride ?? cameraAdjustOverride;
  if (cameraOverride) {
    gameState.zoom = cameraOverride.zoom;
    updateCameraFrustum();
  }

  // 正交相機大幅拉遠時也沿原視角後退，避免視窗下緣落到地面以下而看見天空球。
  const camDist = Math.max(16, gameState.zoom * 1.55);
  const cameraYaw = cameraOverride?.yaw ?? 0;
  const cameraPitch = cameraOverride?.pitch ?? Math.PI / 2 - TILT_RAD;
  const camHeight = camDist * Math.sin(cameraPitch);
  const camHorizontalOffset = camDist * Math.cos(cameraPitch);
  const camXOffset = Math.sin(cameraYaw) * camHorizontalOffset;
  const camZOffset = Math.cos(cameraYaw) * camHorizontalOffset;
  let groundOffset = characterGroundY(
    gameState.currentMapName,
    gameState.player.position.x,
    gameState.player.position.z,
  );
  if (gameState.isSitting) groundOffset -= 0.03;
  // 玩家模型與相機共用地形高度，走上西北階梯或海岸緩坡時不會穿進台階。
  gameState.player.position.y +=
    (groundOffset - gameState.player.position.y) * Math.min(1, dt * 10);
  let cameraFocusX = gameState.player.position.x;
  let cameraFocusZ = gameState.player.position.z;
  if (cameraOverride) {
    // 過場鏡頭接管中：直接用鏡頭清單／手動調整算出來的焦點，略過下面
    // 逐地圖的自動跟隨與邊界夾限(那些是給「正常跟玩家」用的鏡頭邏輯)。
    cameraFocusX = cameraOverride.focusX;
    cameraFocusZ = cameraOverride.focusZ;
  } else if (gameState.currentMapName === "livingArea") {
    const halfViewWidth = camera.right;
    const minFocusX = CAMERA_WORLD_BOUNDS.west + halfViewWidth;
    const maxFocusX = CAMERA_WORLD_BOUNDS.east - halfViewWidth;
    cameraFocusX =
      minFocusX <= maxFocusX
        ? THREE.MathUtils.clamp(
            gameState.player.position.x,
            minFocusX,
            maxFocusX,
          )
        : minFocusX;

    // 正交斜視下，畫面下半部在地面上的 z 跨度約為 gameState.zoom / cos(傾角)。
    // 南端把最南排行道樹保留在畫面底緣後停止追蹤。
    const southGroundHalfView = gameState.zoom / Math.cos(TILT_RAD);
    const maxFocusZ = SOUTHERNMOST_AVENUE_TREE_Z + 1.4 - southGroundHalfView;
    cameraFocusZ = Math.min(gameState.player.position.z, maxFocusZ);
  } else if (gameState.currentMapName === "port") {
    // 港口鏡頭以左上 (0,0) 為硬邊界；縮遠時只向右、向南揭露外海。
    const halfViewWidth = camera.right;
    const halfViewDepth = gameState.zoom / Math.cos(TILT_RAD);
    // 2026-08-26 序幕演出「外海／靠岸」這幾個階段，鏡頭改成直接鎖定
    // 船身(prologueRefs.ferry.position)，不是玩家本身的座標——見
    // prologue.ts 的 isPrologueShipStage() 註解。下船走位／碼頭迎接
    // 這兩個階段條件不成立，鏡頭照常跟著玩家。
    const shipLocked =
      gameState.cutsceneActive && isPrologueShipStage() && prologueRefs.ferry;
    const focusSource = shipLocked
      ? prologueRefs.ferry.position
      : gameState.player.position;
    cameraFocusX = Math.max(focusSource.x, halfViewWidth);
    cameraFocusZ = Math.max(focusSource.z, halfViewDepth);
  } else if (gameState.currentMapName === "oldVillage") {
    // 城鎮與港口鏡像：港口鎖左上，城鎮鎖右上。
    const halfViewWidth = camera.right;
    const halfViewDepth = gameState.zoom / Math.cos(TILT_RAD);
    const rightEdge = LAYOUT.oldVillage.width - 1;
    cameraFocusX = Math.min(
      gameState.player.position.x,
      rightEdge - halfViewWidth,
    );
    cameraFocusZ = Math.max(gameState.player.position.z, halfViewDepth);
  } else if (gameState.currentMapName === "mountain") {
    // 山區固定右下邊界；往左上超出固定視野後才跟隨玩家。
    const halfViewWidth = camera.right;
    const halfViewDepth = gameState.zoom / Math.cos(TILT_RAD);
    const rightEdge = LAYOUT.mountain.width - 1;
    const bottomEdge = LAYOUT.mountain.height - 1;
    cameraFocusX = Math.min(
      gameState.player.position.x,
      rightEdge - halfViewWidth,
    );
    cameraFocusZ = Math.min(
      gameState.player.position.z,
      bottomEdge - halfViewDepth,
    );
  }
  if (gameState.currentMapName === "oldVillage") {
    groundOffset = oldVillageGroundY(
      gameState.player.position.x,
      gameState.player.position.z,
    );
  } else if (gameState.currentMapName === "mountain") {
    groundOffset = mountainGroundY(
      gameState.player.position.x,
      gameState.player.position.z,
    );
  }
  camera.position.set(
    cameraFocusX + camXOffset,
    camHeight + groundOffset,
    cameraFocusZ + camZOffset,
  );
  camera.lookAt(cameraFocusX, groundOffset, cameraFocusZ);

  // 海浪：仿 Gerstner 波浪——頂點升高的同時往岸邊(-X)推移，波峰因此變陡、
  // 波谷變平緩，看起來像浪頭在往前捲；捲到最高點時把該處頂點染白模擬碎浪
  if (gameState.oceanMesh && updateWaterSurface) {
    const posAttr = gameState.oceanMesh.geometry.attributes.position;
    const colorAttr = gameState.oceanMesh.geometry.attributes.color;
    const basePos = gameState.oceanMesh.geometry.userData.basePositions;
    const waveDirections = gameState.oceanMesh.geometry.userData.waveDirections;
    const ox = gameState.oceanMesh.position.x,
      oz = gameState.oceanMesh.position.z;
    const waveSample: any = {};
    const waveDirection = { x: 0, z: 0 };
    for (let i = 0; i < posAttr.count; i++) {
      const bx = basePos[i * 3],
        bz = basePos[i * 3 + 2];
      const worldX = bx + ox,
        worldZ = bz + oz;
      waveDirection.x = waveDirections?.[i * 2] ?? EAST_SEA_WAVE_DIRECTION.x;
      waveDirection.z =
        waveDirections?.[i * 2 + 1] ?? EAST_SEA_WAVE_DIRECTION.z;
      sampleDirectedSeaWave(
        worldX,
        worldZ,
        gameState.effectElapsed,
        waveDirection,
        EAST_SEA_WAVE,
        waveSample,
      );
      posAttr.setX(i, bx + waveSample.displacementX);
      posAttr.setZ(i, bz + waveSample.displacementZ);
      posAttr.setY(i, waveSample.height);

      // 浪頭捲到接近最高點時快速染白，模擬碎浪；其餘地方維持海藍色
      const crestFactor = Math.max(0, (waveSample.crest - 0.4) / 0.6);
      const t = Math.pow(crestFactor, 1.8);
      setSeaVertexColor(
        colorAttr,
        i,
        0.18,
        0.43,
        0.68,
        t,
        0,
      );
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    if (gameState.animationFrameCount % 8 === 0)
      gameState.oceanMesh.geometry.computeVertexNormals();
  }
  // 湖的波紋比海柔和，不做碎浪；夜晚仍依同一套世界座標星光取樣，
  // 讓第一人稱貼近水面時也能看到隨漣漪閃爍的星光，而不是整片死黑。
  if (gameState.lakeMesh && updateWaterSurface) {
    const lPosAttr = gameState.lakeMesh.geometry.attributes.position;
    const lColorAttr = gameState.lakeMesh.geometry.attributes.color;
    const lBase = gameState.lakeMesh.geometry.userData.basePositions;
    const lBaseColors = gameState.lakeMesh.geometry.userData.baseColors;
    const llx = gameState.lakeMesh.position.x,
      llz = gameState.lakeMesh.position.z;
    for (let i = 0; i < lPosAttr.count; i++) {
      const bx = lBase[i * 3],
        bz = lBase[i * 3 + 2];
      const wx = bx + llx,
        wz = bz + llz;
      const y =
        Math.sin(wx * 2.4 + gameState.effectElapsed * 1.1) * 0.011 +
        Math.cos(wz * 2.0 + gameState.effectElapsed * 0.85) * 0.009;
      lPosAttr.setY(i, y);
      const colorOffset = i * 3;
      setSeaVertexColor(
        lColorAttr,
        i,
        lBaseColors[colorOffset],
        lBaseColors[colorOffset + 1],
        lBaseColors[colorOffset + 2],
        0,
        0,
      );
    }
    lPosAttr.needsUpdate = true;
    lColorAttr.needsUpdate = true;
    if (gameState.animationFrameCount % 8 === 0)
      gameState.lakeMesh.geometry.computeVertexNormals();
  }
  if (gameState.seaGlimpseMesh && updateWaterSurface) {
    const sgPosAttr = gameState.seaGlimpseMesh.geometry.attributes.position;
    const sgColorAttr = gameState.seaGlimpseMesh.geometry.attributes.color;
    const sgBase = gameState.seaGlimpseMesh.geometry.userData.basePositions;
    const sgBaseColors = gameState.seaGlimpseMesh.geometry.userData.baseColors;
    const northWaveSample: any = {};
    for (let i = 0; i < sgPosAttr.count; i++) {
      const bx = sgBase[i * 3],
        bz = sgBase[i * 3 + 2];
      const worldX = bx + gameState.seaGlimpseMesh.position.x;
      const worldZ = bz + gameState.seaGlimpseMesh.position.z;
      sampleDirectedSeaWave(
        worldX,
        worldZ,
        gameState.effectElapsed,
        NORTH_SEA_WAVE_DIRECTION,
        NORTH_SEA_WAVE,
        northWaveSample,
      );
      const height = northWaveSample.height;
      const displacementX = northWaveSample.displacementX;
      const displacementZ = northWaveSample.displacementZ;
      const crest = northWaveSample.crest;
      const foamMix = Math.pow(Math.max(0, (crest - 0.45) / 0.55), 1.8) * 0.72;
      const colorOffset = i * 3;
      sgPosAttr.setX(i, bx + displacementX);
      sgPosAttr.setY(i, height);
      sgPosAttr.setZ(i, bz + displacementZ);
      setSeaVertexColor(
        sgColorAttr,
        i,
        sgBaseColors[colorOffset],
        sgBaseColors[colorOffset + 1],
        sgBaseColors[colorOffset + 2],
        foamMix,
        0,
      );
    }
    sgPosAttr.needsUpdate = true;
    sgColorAttr.needsUpdate = true;
    if (gameState.animationFrameCount % 8 === 0)
      gameState.seaGlimpseMesh.geometry.computeVertexNormals();
  }
  // 拍岸浪花：浪頭衝上岸時放大、變亮、泡沫顆粒跟著滾動碎裂；退潮時很快收回去
  foamMeshes.forEach((f) => {
    const phase = gameState.effectElapsed * 2.2 + f.userData.seed;
    const cycle = (Math.sin(phase) + 1) / 2; // 0~1，一波一波衝上岸又退回去
    const shoreTravel = -0.1 + cycle * 0.32;
    const waveDirection = f.userData.waveDirection;
    f.position.x = f.userData.baseX + waveDirection.x * shoreTravel;
    f.position.z = f.userData.baseZ + waveDirection.z * shoreTravel;
    const impact = Math.pow(cycle, 1.5);
    f.userData.crest.material.opacity = impact * 0.85;
    f.userData.crest.scale.set(1 + impact * 0.2, 0.6 + impact * 0.8, 1);
    f.userData.wash.material.opacity = (1 - cycle) * 0.35;
    f.userData.wash.scale.set(0.8 + cycle * 0.5, 1, 1);
    f.userData.bumps.forEach((b, i) => {
      const bp = phase * 1.3 + i * 0.7;
      const bumpScale = Math.max(0.01, Math.sin(bp));
      b.scale.set(bumpScale, bumpScale * (0.3 + impact * 0.5), bumpScale);
      b.rotation.z = gameState.effectElapsed * 3 + i; // 滾動感
      b.material.opacity = impact * 0.8;
    });
  });

  windmillRotors.forEach((rotor) => {
    rotor.rotation.z -= frameDt * 0.62; // 純視覺，對話中不暫停
  });

  // 真魚通常會直線巡游一段、短暫停留，再改成橫向或縱向的新路線；
  // 路線只加一點側向弧度，方向與停留時間每段都不同。
  fishSchool.forEach((f) => {
    if (!f.route && gameState.effectElapsed >= f.pauseUntil)
      startFishRoute(f, gameState.effectElapsed);
    if (!f.route) {
      f.mesh.position.y =
        f.baseY +
        Math.sin(gameState.effectElapsed * 0.8 + f.phase) * f.depthAmp * 0.35;
      return;
    }
    const progress = Math.min(
      1,
      (gameState.effectElapsed - f.route.start) / f.route.duration,
    );
    const sideCurve = Math.sin(progress * Math.PI) * f.route.curve;
    const nx =
      f.route.fromX +
      (f.route.toX - f.route.fromX) * progress +
      (f.route.horizontal ? 0 : sideCurve);
    const nz =
      f.route.fromZ +
      (f.route.toZ - f.route.fromZ) * progress +
      (f.route.horizontal ? sideCurve : 0);
    const dx = nx - f.mesh.position.x,
      dz = nz - f.mesh.position.z;
    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
      const targetAngle = Math.atan2(dx, dz) - Math.PI / 2;
      f.mesh.rotation.y +=
        (((targetAngle - f.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2)) -
          Math.PI) *
        0.09;
    }
    f.mesh.position.x = nx;
    f.mesh.position.z = nz;
    f.mesh.position.y =
      f.baseY + Math.sin(gameState.effectElapsed * 0.75 + f.phase) * f.depthAmp;
    if (progress >= 1) {
      f.route = null;
      // 約七成路段結束後會停 0.7～3.2 秒，其餘直接接下一段。
      f.pauseUntil =
        gameState.effectElapsed +
        (Math.random() < 0.7 ? 0.7 + Math.random() * 2.5 : 0);
    }
  });

  // 牧草短／中／長三階段由 pastureDepletedTiles 的遊戲日齡決定：
  // 收割／放牧當天變短，之後長到中段，第三天恢復成熟。風擺仍逐幀更新。
  // The title presentation pauses gameplay, but its scenery must remain alive.
  // Use real visual time there and keep the wind deliberately gentler than gameplay.
  const isTitleGrassPreview = gameState.titlePresentationActive;
  gameState.grassAnimationAccumulator += isTitleGrassPreview ? frameDt : dt;
  if (gameState.grassAnimationAccumulator >= 1 / 20) {
    gameState.grassAnimationAccumulator = 0;
    const windSpeed = isTitleGrassPreview
      ? 0.72
      : gameState.currentWeather === "typhoon"
        ? 4.8
        : gameState.currentWeather === "storm"
          ? 3.8
          : 2.15;
    const weatherWindStrength = isTitleGrassPreview
      ? 0
      : gameState.currentWeather === "typhoon"
        ? 0.34
        : gameState.currentWeather === "storm"
          ? 0.2
          : 0;
    pastureGrassBlades.forEach((tuft) => {
      const wx = tuft.position.x,
        wz = tuft.position.z;
      const logicalStage = pastureGrassStageAt(
        tuft.userData.tileX,
        tuft.userData.tileZ,
      );
      setPastureGrassStage(tuft, logicalStage < 0 ? 0 : logicalStage);
      const sway = isTitleGrassPreview
        ? 0.035 + tuft.userData.stage * 0.012
        : 0.16 + tuft.userData.stage * 0.09 + weatherWindStrength * 0.22;
      // 雨勢朝 +X；草繞 Z 軸負向傾斜時也會倒向 +X。
      const weatherWindPush =
        weatherWindStrength *
        (0.78 + Math.sin(gameState.elapsed * 2.35 + wz * 0.2) * 0.22);
      const playerDistance =
        gameState.currentMapName === "livingArea"
          ? Math.hypot(
              wx - gameState.player.position.x,
              wz - gameState.player.position.z,
            )
          : Infinity;
      const wake =
        gameState.isMoving && playerDistance < 1.05
          ? (1 - playerDistance / 1.05) * 0.52
          : 0;
      const wakeX =
        playerDistance > 0.001
          ? ((wx - gameState.player.position.x) / playerDistance) * wake
          : 0;
      const wakeZ =
        playerDistance > 0.001
          ? ((wz - gameState.player.position.z) / playerDistance) * wake
          : 0;
      tuft.userData.blades.forEach((pivot) => {
        const wave =
          (isTitleGrassPreview ? gameState.effectElapsed : gameState.elapsed) *
            windSpeed +
          pivot.userData.phase +
          wx * 0.72 +
          wz * 0.28;
        pivot.rotation.z =
          pivot.userData.baseRotZ +
          Math.sin(wave) * sway -
          weatherWindPush -
          wakeX;
        pivot.rotation.x =
          pivot.userData.baseRotX +
          Math.sin(wave * 0.82 + 1.4) * sway * 0.45 +
          wakeZ;
      });
    });
  }

  gameState.hudUpdateAccumulator += dt;
  if (gameState.hudUpdateAccumulator >= 0.2) {
    gameState.hudUpdateAccumulator = 0;
    updateHud();
  }
  const gameplayCamera = getGameplayCamera(camera);
  updatePlanarWaterReflection(gameplayCamera, gameState.animationFrameCount);
  renderer.render(scene, gameplayCamera);
}

addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  updateCameraFrustum();
});
