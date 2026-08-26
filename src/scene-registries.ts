import { gameState } from "./game-state";

export const windowMats = [];
export const waterSurfaceMaterials: import("three").MeshStandardMaterial[] = [];
export const waterSkyUnderlayMaterials: import("three").MeshStandardMaterial[] = [];
      // 地圖切換點的黃色門檻標記，跟其他登記表同一套：buildMap() 清空重建，
      // 之後不用重新整理地圖也能一次切換全部標記的顯示/隱藏(見 build-map.ts
      // 的 setThresholdMarkersVisible)。
      export const thresholdMarkerMeshes = [];
      // buildMap() 建立目前地圖的採集物件後登記在這裡；刷新時會原地搬到
      // 新的隨機座標，採完則把整個 group 隱藏。
      export const gatherNodeMeshes: {
        group: import("three").Group;
        nodeId: string;
        map: "livingArea" | "mountain";
      }[] = [];
      // 鐘乳石洞窟礦石節點——跟 gatherNodeMeshes 同一套模式，buildMap()
      // 重建這個地圖時清空重登記；礦石是「換樓層才重灑」不是「按時段
      // 刷新」，所以不需要 gatherNodeMeshes 那種原地搬動邏輯，採完直接
      // 隱藏就好。
      export const oreNodeMeshes: {
        group: import("three").Group;
        nodeId: string;
      }[] = [];
      const THRESHOLD_VISIBLE_KEY = "meadowtide.debug.thresholdMarkersVisible";
      // 開發模式下記住這個開關：Vite 幾乎每次存檔都會整頁重新載入(見
      // chef-quest.ts 對同一個現象的說明)，沒有這段的話每次改完程式碼
      // 都要重新在主控台關一次，不算「快速隱藏」。production build 這個
      // if 會被靜態消掉。
      let initialVisible = true;
      if (import.meta.env.DEV) {
        try {
          const saved = localStorage.getItem(THRESHOLD_VISIBLE_KEY);
          if (saved !== null) initialVisible = saved === "true";
        } catch (err) {
          // 開發輔助功能而已，讀取失敗就用預設值
        }
      }
      export let thresholdMarkersVisible = initialVisible;
      export function setThresholdMarkersVisible(visible) {
        thresholdMarkersVisible = visible;
        thresholdMarkerMeshes.forEach((m) => {
          m.visible = visible;
        });
        if (import.meta.env.DEV) {
          try {
            localStorage.setItem(THRESHOLD_VISIBLE_KEY, String(visible));
          } catch (err) {
            // 同上，寫入失敗不影響遊戲本身
          }
        }
      }
      // 港口渡輪的跳板——靠港時放下讓人上下船，啟航/行駛中收起。跟其他
      // 「buildMap() 清空重建」的登記表同一套，game-loop.ts 只需要逐幀切換
      // .visible，不用重新蓋地圖。
      export const gangplankMeshes = [];
// 序幕(開場第一天演出，見 src/prologue.ts)要在船隻/跳板都蓋好之後才拿
// 得到實際的 Object3D 參照跟跳板的「靜止角度」，makePortScene() 建完
// ferry/gangplank 這兩個 group 就順手填進來。用單一可變物件、不是各自
// export let，是因為 ES module 的 `let` 綁定從其他檔案 import 進去之後
// 是唯讀的(不能 `importedLet = x`，只能改物件屬性)，跟 gameState 那個
// 大物件是同一個理由；gangplankRestRotationZ 是跳板建好當下算出來的
// 「碼頭端固定、船那端墊船板高度差」那個坡度角，序幕演出時跳板從立起
// (90 度)降到這個角度，不是重新算一次。
export const prologueRefs: {
  ferry: import("three").Group | null;
  gangplank: import("three").Group | null;
  ferryRestX: number;
  gangplankRestRotationZ: number;
  // 2026-08-26 第二輪：跳板收合狀態(演出中「立起貼在船頭」的那幾秒)
  // 需要把整個 gangplank 挪到船頭、動畫時再挪回這個原始停靠位置，跟
  // rotation 一樣要先把「原本蓋出來的樣子」記下來，不能演出跑到一半
  // 才回頭現算。
  gangplankRestPosition: import("three").Vector3 | null;
} = {
  ferry: null,
  gangplank: null,
  ferryRestX: 0,
  gangplankRestRotationZ: 0,
  // 跟 ferry/gangplank 一樣先給 null，這個檔案刻意不 import 整個
  // THREE(上面其他型別都是用 import("three").X 這種型別限定寫法，不
  // 拉執行期依賴)，makePortScene() 蓋完跳板後才用 .clone() 填進來。
  gangplankRestPosition: null,
};
      export const outdoorLampLights = [];
      export const foamMeshes = []; // 沙灘跟海交界的拍岸泡沫，animate() 裡逐幀讓它忽明忽暗
      export const windmillRotors = [];
      export const lakeShoreColliders = []; // 湖岸石頭的圓形碰撞，建圖時與石頭位置同步
      export const fishSchool = []; // 每條魚各自保存尺寸、速度、橢圓半徑、游移與深度參數
      // 天梯(makeCelestialSpiralStaircase()/makeCelestialSparkles()，
      // props.ts)周圍的閃耀星點材質——每次進山之洞第25層由 build-map.ts
      // 重灑星點時整批清空重建，animate() 逐幀讀這份清單更新每個
      // PointsMaterial 的 opacity 做出閃爍(跟 foamMeshes/windowMats 這些
      // 其他「登記進陣列、animate() 逐幀處理」的特效同一套慣例)。
      export const celestialSparkleMaterials: import("three").PointsMaterial[] = [];
      export const EAST_SEA_WAVE_DIRECTION = Object.freeze({ x: -1, z: 0 });
      export const SOUTH_SEA_WAVE_DIRECTION = Object.freeze({ x: 0, z: -1 });
      export const WEST_SEA_WAVE_DIRECTION = Object.freeze({ x: 1, z: 0 });
      // 東北外海朝西南方推進；sampleDirectedSeaWave 會再次正規化。
      export const NORTHEAST_SEA_WAVE_DIRECTION = Object.freeze({ x: -1, z: 1 });
      export const EAST_SEA_WAVE = Object.freeze({
        waveNumber: 1.4,
        speed: 2.2,
        height: 0.09,
        steepness: 0.55,
        crossNumber: 0.8,
        crossAmount: 0.5,
        secondaryNumber: 1.2,
        secondarySpeed: 1,
        secondaryHeight: 0.015,
      });
      export const NORTH_SEA_WAVE = Object.freeze({
        waveNumber: 1.65,
        speed: 1.25,
        height: 0.045,
        steepness: 0.42,
        crossNumber: 0.28,
        crossAmount: 0.55,
        secondaryNumber: 0.72,
        secondarySpeed: 0.8,
        secondaryHeight: 0.018,
      });

      // 波峰沿 direction 前進；沿浪與橫浪座標都由世界座標投影取得。
      export function sampleDirectedSeaWave(
        worldX,
        worldZ,
        time,
        direction,
        settings,
        out,
      ) {
        const length = Math.hypot(direction.x, direction.z) || 1;
        const directionX = direction.x / length;
        const directionZ = direction.z / length;
        const sideX = -directionZ;
        const sideZ = directionX;
        const along = worldX * directionX + worldZ * directionZ;
        const across = worldX * sideX + worldZ * sideZ;
        const phase =
          along * settings.waveNumber -
          time * settings.speed +
          Math.sin(across * settings.crossNumber) * settings.crossAmount;
        const sinPhase = Math.sin(phase);
        const displacement =
          Math.cos(phase) * settings.height * settings.steepness;
        out.height =
          sinPhase * settings.height +
          Math.cos(
            across * settings.secondaryNumber - time * settings.secondarySpeed,
          ) *
            settings.secondaryHeight;
        out.crest = sinPhase;
        out.displacementX = directionX * displacement;
        out.displacementZ = directionZ * displacement;
        return out;
      }
      export const SEA_FISH_SCALE = 3;
      export const LAKE_FISH_SCALE = 2.2;
      export const avenueLeafMaterials = [];
      export const seasonalTreeLeafMaterials = [];
      export const seasonalGroundMaterials = [];
      export const mountainSeasonalMaterials: Array<{
        material: import("three").MeshStandardMaterial;
        baseColor: number;
        winterColor: number;
        // 只有真正的草地材質才會給這欄——石頭/木棧板/階梯沒有秋天落葉，維持
        // baseColor/winterColor 兩色循環；省略這欄的項目在秋天照樣用 baseColor。
        autumnColor?: number;
      }> = [];
      export const pastureGrassBlades = []; // 牧場裡會被風吹動的草叢，每叢存自己的葉片群組
      export const GRASS_STAGE_HEIGHTS = [0.2, 0.46, 0.82]; // 短、中、長；長草約到動物胸高

