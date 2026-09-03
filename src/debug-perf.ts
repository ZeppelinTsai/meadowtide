// 效能測試專用 harness——2026-09-03 因應「檢測目前效能」需求新增。
//
// 為什麼不像 debug-character.ts 那樣做成獨立最小場景：build-map.ts 的
// buildMap()/loadMap() 深度依賴 scene-sky.ts 的 scene/renderer 單例、
// gameState、weather-particles、npc-runtime 等模組級全域狀態，硬是抽離
// 會等於重寫一份小型引擎。改成從 main.ts 自己的 import graph 裡掛一個
// installPerfHarness()，保證跟真正在跑的遊戲共用同一份單例，也避開了
// 先前從瀏覽器 console 用 import() 讀到「另一份模組實例」、gameState
// 讀不到最新值的問題。
//
// 用法（跑完序章、有 gameState.player 之後，在瀏覽器 console）：
//   window.__perf.runSuite()          // 跑完整矩陣，回傳結果陣列並 console.table
//   window.__perf.runSuite({ quick: true })  // 快速版，每格只採樣 500ms
// 也可以手動單步：
//   await window.__perf.loadMapAsync("port")
//   window.__perf.setTime(1, 14, 0)   // 夏天、第14天、午夜(流星雨用)
//   window.__perf.setWeather("clear")
//   window.__perf.setCamera("first")
//   await window.__perf.sample(1500)

import * as THREE from "three";
import { gameState } from "./game-state";
import {
  rollWeatherForSeason,
  TIME_CONFIG,
  FULL_MOON_SEASON_DAY,
} from "./game-state";
import { renderer } from "./scene-sky";
import { loadMap } from "./build-map";
import { MAPS } from "./layout-maps";
import {
  isFirstPersonModeActive,
  toggleFirstPersonMode,
} from "./first-person-camera";

export interface PerfSample {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// loadMap() 內部先 fadeOut(cb) 400ms 後才真的呼叫 buildMap()，這裡多留
// 一點緩衝(900ms)讓地圖建置+第一批材質/陰影編譯完成，採樣才不會把「剛
// 換圖那幾幀特別慢」算進平均值裡，那不是穩定狀態下的效能。
export function loadMapAsync(
  mapName: string,
  pos?: { x: number; z: number },
  settleMs = 900,
): Promise<void> {
  return new Promise((resolve) => {
    loadMap(mapName as any, pos as any);
    setTimeout(resolve, settleMs);
  });
}

// seasonIndex: 0=春 1=夏 2=秋 3=冬；seasonDay: 1~21(1-indexed，14=滿月/
// 流星雨高峰日，對齊 FULL_MOON_SEASON_DAY)；phase: 0~1，一天的比例
// (0=午夜 0.5=正午)，跟 gameState.currentPhase 定義一致。
export function setTime(
  seasonIndex: number,
  seasonDay: number,
  phase: number,
  weather?: string,
) {
  const day = seasonIndex * TIME_CONFIG.daysPerSeason + (seasonDay - 1);
  gameState.currentSeason = seasonIndex;
  gameState.currentDay = day;
  gameState.currentPhase = phase;
  gameState.currentWeather = (weather ??
    rollWeatherForSeason(seasonIndex, day)) as any;
}

export function setWeather(weather: string) {
  gameState.currentWeather = weather as any;
}

export function setCamera(mode: "first" | "third") {
  const active = isFirstPersonModeActive();
  if (mode === "first" && !active) toggleFirstPersonMode();
  if (mode === "third" && active) toggleFirstPersonMode();
}

// 跳過第一顆 rAF delta(通常異常大，是排程誤差不是真的掉幀)，其餘每幀
// 累加 dt 跟 renderer.info 的 render.calls/triangles 再平均。
// renderer.info.autoReset預設true，每次render()後只留「這一幀」的數字，
// 所以要逐幀累加才能拿到這段取樣視窗的平均值，不是只看最後一幀。
export function sample(durationMs = 1500): Promise<PerfSample> {
  return new Promise((resolve) => {
    let frames = 0;
    let lastT = performance.now();
    const start = lastT;
    let sumFrameMs = 0;
    let sumCalls = 0;
    let sumTri = 0;
    function tick(now: number) {
      const dt = now - lastT;
      lastT = now;
      if (frames > 0) {
        sumFrameMs += dt;
        sumCalls += renderer.info.render.calls;
        sumTri += renderer.info.render.triangles;
      }
      frames++;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
      } else {
        const n = Math.max(1, frames - 1);
        resolve({
          fps: Math.round((1000 / (sumFrameMs / n)) * 10) / 10,
          frameMs: Math.round((sumFrameMs / n) * 100) / 100,
          drawCalls: Math.round(sumCalls / n),
          triangles: Math.round(sumTri / n),
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        });
      }
    }
    requestAnimationFrame(tick);
  });
}

const OUTDOOR_MAPS: { name: string; label: string }[] = [
  { name: "livingArea", label: "牧場/生活區" },
  { name: "port", label: "港口" },
  { name: "oldVillage", label: "城鎮" },
  { name: "mountain", label: "山" },
];

const SEASONS = [
  { index: 0, label: "春" },
  { index: 1, label: "夏" },
  { index: 2, label: "秋" },
  { index: 3, label: "冬" },
];

interface SuiteRow {
  scenario: string;
  map: string;
  season: string;
  time: string;
  weather: string;
  camera: string;
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export interface SuiteOptions {
  quick?: boolean; // true: 每格 500ms 採樣、跳過部分組合，先抓量級
  sampleMs?: number;
  onRow?: (row: SuiteRow) => void;
}

export async function runSuite(opts: SuiteOptions = {}): Promise<SuiteRow[]> {
  if (!gameState.player) {
    console.error(
      "[效能測試] gameState.player 還不存在——先跑完序章或讀一個存檔到遊戲內，再呼叫 runSuite()。",
    );
    return [];
  }
  // 跑完整套矩陣一定會亂改當下的地圖/季節/天氣/日夜/鏡頭，測完不還原的話
  // 玩家自己的存檔進度會被污染(季節跳掉、天氣變了)，所以先拍一張快照，
  // 不管中途有沒有出錯，最後都要 finally 還原回去。
  const snapshot = {
    mapName: gameState.currentMapName,
    playerGridPos: { ...gameState.playerGridPos },
    season: gameState.currentSeason,
    day: gameState.currentDay,
    phase: gameState.currentPhase,
    weather: gameState.currentWeather,
    firstPerson: isFirstPersonModeActive(),
  };
  const sampleMs = opts.sampleMs ?? (opts.quick ? 500 : 1500);
  const cameras: ("third" | "first")[] = ["third", "first"];
  const rows: SuiteRow[] = [];
  const pushRow = async (
    partial: Omit<SuiteRow, "fps" | "frameMs" | "drawCalls" | "triangles" | "geometries" | "textures">,
  ) => {
    const s = await sample(sampleMs);
    const row: SuiteRow = { ...partial, ...s };
    rows.push(row);
    opts.onRow?.(row);
    console.log(
      `[效能測試] ${row.scenario}  fps=${row.fps} frameMs=${row.frameMs} drawCalls=${row.drawCalls} tri=${row.triangles}`,
    );
    return row;
  };

  console.log(
    `[效能測試] 開始跑矩陣：${OUTDOOR_MAPS.length}張地圖 × ${SEASONS.length}季 × (白天/夜晚/流星雨高峰) × ${cameras.length}種鏡頭，取樣${sampleMs}ms/格。`,
  );

  for (const map of OUTDOOR_MAPS) {
    await loadMapAsync(map.name, { ...(MAPS as any)[map.name].playerStart });
    for (const season of SEASONS) {
      // 白天(正午，晴天)
      setTime(season.index, 10, 0.5, "clear");
      for (const cam of cameras) {
        setCamera(cam);
        await pushRow({
          scenario: `${map.label}/${season.label}/白天/${cam === "first" ? "第一人稱" : "第三人稱"}`,
          map: map.label,
          season: season.label,
          time: "白天",
          weather: "clear",
          camera: cam,
        });
      }
      // 夜晚(午夜，晴天，非流星雨日)
      setTime(season.index, 10, 0.0, "clear");
      for (const cam of cameras) {
        setCamera(cam);
        await pushRow({
          scenario: `${map.label}/${season.label}/夜晚/${cam === "first" ? "第一人稱" : "第三人稱"}`,
          map: map.label,
          season: season.label,
          time: "夜晚",
          weather: "clear",
          camera: cam,
        });
      }
      // 流星雨高峰日(第14天，午夜，晴天——雨/颱風/暴風雪會讓流星機率歸零)
      setTime(season.index, FULL_MOON_SEASON_DAY, 0.0, "clear");
      for (const cam of cameras) {
        setCamera(cam);
        await pushRow({
          scenario: `${map.label}/${season.label}/流星雨高峰(D14)/${cam === "first" ? "第一人稱" : "第三人稱"}`,
          map: map.label,
          season: season.label,
          time: "流星雨高峰",
          weather: "clear",
          camera: cam,
        });
      }
    }
  }

  // 天氣專項：不用全地圖全季節都跑一輪(組合爆炸)，抓有代表性的戶外地圖
  // (牧場/生活區——最多草木粒子/最容易吃效能；港口——海面+更多開闊視野)
  // 在對應季節、第三人稱下測，雨天則季節無關只測一次。
  const weatherCases: {
    weather: string;
    seasonIndex: number;
    seasonLabel: string;
    label: string;
  }[] = [
    { weather: "rain", seasonIndex: 0, seasonLabel: "春", label: "下雨" },
    { weather: "typhoon", seasonIndex: 1, seasonLabel: "夏", label: "颱風" },
    { weather: "storm", seasonIndex: 1, seasonLabel: "夏", label: "暴風雨" },
    { weather: "snow", seasonIndex: 3, seasonLabel: "冬", label: "下雪" },
    { weather: "blizzard", seasonIndex: 3, seasonLabel: "冬", label: "暴風雪" },
  ];
  for (const map of [OUTDOOR_MAPS[0], OUTDOOR_MAPS[1]]) {
    await loadMapAsync(map.name, { ...(MAPS as any)[map.name].playerStart });
    for (const wc of weatherCases) {
      setTime(wc.seasonIndex, 10, 0.5, wc.weather);
      setCamera("third");
      await pushRow({
        scenario: `${map.label}/${wc.seasonLabel}/${wc.label}(天氣)/第三人稱`,
        map: map.label,
        season: wc.seasonLabel,
        time: "白天",
        weather: wc.weather,
        camera: "third",
      });
    }
  }

  console.log(`[效能測試] 全部跑完，共 ${rows.length} 筆。window.__perf.results 已更新，還原回測試前的狀態中...`);
  gameState.currentSeason = snapshot.season;
  gameState.currentDay = snapshot.day;
  gameState.currentPhase = snapshot.phase;
  gameState.currentWeather = snapshot.weather;
  setCamera(snapshot.firstPerson ? "first" : "third");
  await loadMapAsync(snapshot.mapName, snapshot.playerGridPos);
  console.table(rows);
  return rows;
}

export function installPerfHarness() {
  (window as any).__perf = {
    THREE,
    gameState,
    renderer,
    loadMapAsync,
    setTime,
    setWeather,
    setCamera,
    isFirstPersonModeActive,
    sample,
    runSuite: async (opts?: SuiteOptions) => {
      const rows = await runSuite(opts);
      (window as any).__perf.results = rows;
      return rows;
    },
    results: [] as SuiteRow[],
  };
  console.info(
    "[效能測試] window.__perf 已掛載——序章跑完、有 gameState.player 之後可呼叫 window.__perf.runSuite()。",
  );
}
