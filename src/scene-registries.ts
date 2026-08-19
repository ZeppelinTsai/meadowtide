import { gameState } from "./game-state";

export const windowMats = [];
      export const outdoorLampLights = [];
      export const foamMeshes = []; // 沙灘跟海交界的拍岸泡沫，animate() 裡逐幀讓它忽明忽暗
      export const windmillRotors = [];
      export const lakeShoreColliders = []; // 湖岸石頭的圓形碰撞，建圖時與石頭位置同步
      export const fishSchool = []; // 每條魚各自保存尺寸、速度、橢圓半徑、游移與深度參數
      export const EAST_SEA_WAVE_DIRECTION = Object.freeze({ x: -1, z: 0 });
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
      export const pastureGrassBlades = []; // 牧場裡會被風吹動的草叢，每叢存自己的葉片群組
      export const GRASS_STAGE_HEIGHTS = [0.2, 0.46, 0.82]; // 短、中、長；長草約到動物胸高
      export const GRASS_GROWTH_SECONDS = 32;
