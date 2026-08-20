import * as THREE from "three";
import { isOutdoorMap } from "./environment";
import { hash2 } from "./utils";
import {
  LAYOUT,
  SHRINE_PATH_START_X,
  SHRINE_PATH_LENGTH,
  SHRINE_PATH_ELEVATION,
} from "./layout-maps";
import { gameState } from "./game-state";
import { waterSparkleMaterials } from "./scene-registries";
import {
  getNightFactor,
  getDaylightForSeason,
  getSeasonDay,
  isNightTime,
  weatherTransitionRamp,
  TIME_CONFIG,
  METEOR_CONFIG,
  METEOR_SHOWER_SCHEDULE,
  METEOR_SHOWER_PHASE_NAMES,
  SEASON_NAMES,
  dayLength,
} from "./game-state";

// 5) 場景 / 相機 / 渲染器
      // ==============================================================
      export const TILE = 1;

      // ==============================================================
      // 地形高度 — 房子到海邊墊高，中間三格(x=11,12,13)做成階梯緩坡下到沙灘。
      // 這是「假 3D」的簡化版：地面視覺上有高低，但碰撞判定完全不變，還是
      // 純 2D 網格擋不擋路；階梯用相鄰不同高度的方塊自然產生，不用額外做斜面
      // ==============================================================
      export const PLATEAU_Y = 0.55;
      export const NORTH_TERRAIN_EXTENSION = 6;
      // 最大拉遠時相機會看過南側地圖邊界；延伸純視覺地面，避免天空從底部露出。
      export const SOUTH_TERRAIN_EXTENSION = 90;
      export const NORTH_CLIFF_Z = -5.7;
      export const CAMERA_WORLD_BOUNDS = Object.freeze({
        west: -5,
        east: LAYOUT.coast.rampX + LAYOUT.coast.rampWidth - 0.85 + 26.7,
      });
      export function northCliffEdgeZ(x) {
        return (
          NORTH_CLIFF_Z +
          Math.sin(x * 0.38) * 0.38 +
          Math.sin(x * 0.91 + 1.7) * 0.18 +
          (hash2(x * 3.1, 7.4) - 0.5) * 0.12
        );
      }
      export function groundY(x, z = Infinity) {
        const gateway = LAYOUT.mountainGateway;
        for (let i = 0; i < gateway.steps - 1; i++) {
          const stepX = gateway.startX - i;
          const stepZ = gateway.startZ - i;
          if (Math.abs(x - stepX) <= 0.72 && Math.abs(z - stepZ) <= 0.72)
            return PLATEAU_Y + i * gateway.risePerStep;
        }
        // 女神祠堂步道墊高浮出海面，玩家站上去要跟著抬高，不然會看起來
        // 陷進沙洲裡；範圍跟 build-map.ts 的 makeShrinePathCauseway()、
        // layout-maps.ts 鑿沙灘那段用同一組常數，三處保持一致。
        if (
          z <= 2 &&
          x >= SHRINE_PATH_START_X - 0.5 &&
          x < SHRINE_PATH_START_X + SHRINE_PATH_LENGTH - 0.5
        ) {
          return SHRINE_PATH_ELEVATION;
        }
        const xi = Math.round(x);
        const rampX = LAYOUT.coast.rampX;
        if (xi < rampX) return PLATEAU_Y;
        if (xi === rampX) return PLATEAU_Y * 0.75;
        if (xi === rampX + 1) return PLATEAU_Y * 0.5;
        if (xi === rampX + 2) return PLATEAU_Y * 0.25;
        return 0;
      }
      export const scene = new THREE.Scene();
      export const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.outputEncoding = THREE.sRGBEncoding;
      document.body.appendChild(renderer.domElement);

      // 初始相機視錐不能在模組頂層讀 gameState.zoom：game-state.ts 會 import
      // npc-runtime.ts/farm-visuals.ts/dialogue.ts，這三個檔案又都會（直接或
      // 透過彼此）eagerly import 這個檔案取得 scene/PLATEAU_Y，形成循環——
      // 若這裡在模組求值當下讀 gameState，會在 game-state.ts 還沒跑到
      // `export const gameState = {...}` 之前被回頭引用，觸發 TDZ
      // ReferenceError。這個時間點 gameState.zoom 保證還是宣告時的預設值
      // （沒有任何程式碼會在模組圖載入完成前改到它），所以直接寫死同一個值；
      // 之後所有即時縮放都走 updateCameraFrustum()（resize/滾輪才會呼叫，
      // 那時模組圖早已載入完畢，讀 gameState.zoom 是安全的）。
      const INITIAL_ZOOM = 10;
      export const camera = new THREE.OrthographicCamera(
        -INITIAL_ZOOM * (innerWidth / innerHeight),
        INITIAL_ZOOM * (innerWidth / innerHeight),
        INITIAL_ZOOM,
        -INITIAL_ZOOM,
        0.1,
        220,
      );
      scene.add(camera); // 星空遠景層掛在相機下，確保正交視角中穩定可見
      export const TILT_DEG = 55;
      export const TILT_RAD = (TILT_DEG * Math.PI) / 180;

      export const ambient = new THREE.AmbientLight(0xffffff, 0.65);
      scene.add(ambient);
      export const sun = new THREE.DirectionalLight(0xffffff, 0.9);
      sun.position.set(6, 20, 9);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -18;
      sun.shadow.camera.right = 18;
      sun.shadow.camera.top = 18;
      sun.shadow.camera.bottom = -18;
      scene.add(sun);
      export const seasonalBounceLight = new THREE.HemisphereLight(
        0xffffff,
        0x58704e,
        0,
      );
      scene.add(seasonalBounceLight);

      export function updateCameraFrustum() {
        const a = innerWidth / innerHeight;
        camera.left = -gameState.zoom * a;
        camera.right = gameState.zoom * a;
        camera.top = gameState.zoom;
        camera.bottom = -gameState.zoom;
        camera.updateProjectionMatrix();
      }
      // 建構子已經用 INITIAL_ZOOM 算出同一組數字並自動呼叫過
      // updateProjectionMatrix() 一次，這裡不用再呼叫一次；且這裡若在模組
      // 頂層呼叫會讀 gameState.zoom，見上面 camera 建構那段的說明。

      export const DAY = {
        sky: new THREE.Color(0x9fd6ff),
        ambient: 0.65,
        sunIntensity: 0.9,
        sunColor: new THREE.Color(0xffffff),
      };
      export const NIGHT = {
        sky: new THREE.Color(0x01030a),
        ambient: 0.18,
        sunIntensity: 0.12,
        sunColor: new THREE.Color(0x8fa8ff),
      };
      export const INTERIOR_BACKGROUND_COLOR = new THREE.Color(0x28231f);
      export const SUMMER_SUN_COLOR = new THREE.Color(0xffedba);
      export const AUTUMN_SUN_COLOR = new THREE.Color(0xffd2a0);
      export const WINTER_LIGHT_COLOR = new THREE.Color(0xe4f3ff);
      export const NOON_WARM_COLOR = new THREE.Color(0xffd58a);
      export const WINTER_AMBIENT_COLOR = new THREE.Color(0xddecff);
      export const SUMMER_BOUNCE_GROUND = new THREE.Color(0x6f7b4b);
      export const WINTER_BOUNCE_GROUND = new THREE.Color(0xb9cee0);

      // 天空球——沒辦法匯入真的照片(單一 HTML 檔案，不接外部圖床)，改用程式生成
      // 的漸層天空：一顆包住整個場景的大球，內側渲染，頂點顏色從地平線色漸層到
      // 天頂色，每幀跟著日夜循環更新。跟著相機位置走，才會感覺「天空無限遠」
      export const SKY_DAY_ZENITH = new THREE.Color(0x0f6fca),
        SKY_DAY_MID = new THREE.Color(0x55b5ee),
        SKY_DAY_HORIZON = new THREE.Color(0x8bd3f5);
      export const SKY_NIGHT_ZENITH = new THREE.Color(0x000103),
        SKY_NIGHT_MID = new THREE.Color(0x020612),
        SKY_NIGHT_HORIZON = new THREE.Color(0x060d20);
      export const skyGeo = new THREE.SphereGeometry(85, 24, 16);
      export const skyColorAttr = new THREE.BufferAttribute(
        new Float32Array(skyGeo.attributes.position.count * 3),
        3,
      );
      skyGeo.setAttribute("color", skyColorAttr);
      export const skyDome = new THREE.Mesh(
        skyGeo,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      skyDome.renderOrder = -1;
      scene.add(skyDome);

      // 架空北緯 8°海島的四季星空：四季合計涵蓋大部分南北天代表星群。
      export const SEASON_STAR_CONFIGS = [
        { count: 1440, color: 0xe8f4ff }, // 春：柔和
        { count: 2100, color: 0xddeaff }, // 夏：銀河最密
        { count: 1620, color: 0xffedcf }, // 秋：清澈
        { count: 1860, color: 0xd7e9ff }, // 冬：冷藍
      ];
      export const seasonalStarGroups = [];
      export function makeSparkleTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 15);
        glow.addColorStop(0, "rgba(255,255,255,1)");
        glow.addColorStop(0.18, "rgba(255,255,255,0.82)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
        const rayX = ctx.createLinearGradient(0, 0, 64, 0);
        rayX.addColorStop(0, "rgba(255,255,255,0)");
        rayX.addColorStop(0.5, "rgba(255,255,255,0.95)");
        rayX.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rayX;
        ctx.fillRect(2, 30.8, 60, 2.4);
        const rayY = ctx.createLinearGradient(0, 0, 0, 64);
        rayY.addColorStop(0, "rgba(255,255,255,0)");
        rayY.addColorStop(0.5, "rgba(255,255,255,0.95)");
        rayY.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = rayY;
        ctx.fillRect(30.8, 2, 2.4, 60);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        return texture;
      }
      export const STAR_SPARKLE_TEXTURE = makeSparkleTexture();
      export const STAR_SPARKLE_COLORS = [
        0xffffff, 0xc9e8ff, 0x9fe8ff, 0xaef4dc, 0xffef9f, 0xffc98f, 0xffb3c8,
        0xe6c4ff, 0xb8c8ff, 0xd8ffd0,
      ];
      // 水面星光倒影——直接沿用天上那批星星同一張十字星芒貼圖跟色盤，散布
      // 在水面上方一點點的高度。故意不是真的鏡射(不用 CubeCamera/Reflector
      // 算實際反射)，只是用同一套視覺語言在水面上疊一批小亮點，opacity
      // 由呼叫端(game-loop.ts)跟著 nightFactor/天氣同步，晴朗深夜最清楚。
      export function makeWaterSparklePoints(
        minX,
        maxX,
        minZ,
        maxZ,
        count,
        baseY,
        insideShapeFn = null,
      ) {
        const positions = [];
        const colors = [];
        // insideShapeFn 選填：像湖是橢圓形，光用外接矩形亂數撒點，四個角落
        // 會冒出漂在草地上的星光點，看起來很怪。傳這個 function 進來就能
        // 濾掉矩形內、但不在真正水域形狀裡的點；每個點最多重試幾次找不到
        // 就跳過，不會卡住迴圈。
        for (let i = 0; i < count; i++) {
          let px = 0,
            pz = 0,
            found = false;
          for (let attempt = 0; attempt < 6 && !found; attempt++) {
            const nx = hash2(i * 7.3 + minX * 1.3 + attempt * 11, minZ + 1.7);
            const nz = hash2(i * 4.1 + maxX * 0.7 + attempt * 17, maxZ + 2.9);
            px = minX + nx * (maxX - minX);
            pz = minZ + nz * (maxZ - minZ);
            found = !insideShapeFn || insideShapeFn(px, pz);
          }
          if (!found) continue;
          positions.push(px, baseY, pz);
          const color = new THREE.Color(
            STAR_SPARKLE_COLORS[
              Math.floor(hash2(i, minX + maxZ) * STAR_SPARKLE_COLORS.length) %
                STAR_SPARKLE_COLORS.length
            ],
          );
          colors.push(color.r, color.g, color.b);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colors, 3),
        );
        const material = new THREE.PointsMaterial({
          color: 0xffffff,
          vertexColors: true,
          map: STAR_SPARKLE_TEXTURE,
          size: 5,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const points = new THREE.Points(geometry, material);
        points.renderOrder = 4; // 蓋在水面(含波浪頂點色)上面，不被水面遮住
        points.frustumCulled = false;
        waterSparkleMaterials.push(material);
        return points;
      }
      export function makeMilkyWayTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const band = ctx.createLinearGradient(0, 0, 0, canvas.height);
        band.addColorStop(0, "rgba(90,110,190,0)");
        band.addColorStop(0.22, "rgba(105,128,220,0.2)");
        band.addColorStop(0.42, "rgba(176,192,255,0.42)");
        band.addColorStop(0.5, "rgba(238,239,255,0.62)");
        band.addColorStop(0.6, "rgba(202,178,244,0.42)");
        band.addColorStop(0.78, "rgba(139,105,210,0.2)");
        band.addColorStop(1, "rgba(80,95,170,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 180; i++) {
          const x = hash2(i * 3.7, 8.1) * canvas.width;
          const y = canvas.height * (0.32 + hash2(i * 5.9, 2.4) * 0.36);
          const radius = 8 + hash2(i * 7.3, 4.6) * 28;
          const cloud = ctx.createRadialGradient(x, y, 0, x, y, radius);
          cloud.addColorStop(0, "rgba(205,215,255,0.12)");
          cloud.addColorStop(1, "rgba(150,170,240,0)");
          ctx.fillStyle = cloud;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        for (let i = 0; i < 900; i++) {
          const x = hash2(i * 2.13, 3.2) * canvas.width;
          const centerBias =
            (hash2(i * 7.41, 9.8) + hash2(i * 4.17, 1.2) - 1) * 0.5;
          const y = canvas.height * (0.5 + centerBias * 0.62);
          const alpha = 0.12 + hash2(i * 8.2, 6.5) * 0.5;
          const size = 0.35 + hash2(i * 5.4, 7.7) * 1.25;
          ctx.fillStyle = `rgba(225,232,255,${alpha})`;
          ctx.fillRect(x, y, size, size);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        return texture;
      }
      export const MILKY_WAY_TEXTURE = makeMilkyWayTexture();
      export function starSkyPoint(nx, ny, seasonIndex) {
        // 覆蓋最大縮放(gameState.zoom=18)與寬螢幕的完整遠景天幕；地形靠深度緩衝遮住星點。
        return new THREE.Vector3(
          nx * 70,
          (ny - 0.5) * 42 + seasonIndex * 0.22,
          -78,
        );
      }
      export function makeSeasonStarGroup(seasonIndex) {
        const config = SEASON_STAR_CONFIGS[seasonIndex];
        const group = new THREE.Group();
        const positions = [];
        for (let i = 0; i < config.count; i++) {
          const nx = (hash2(i * 7.17 + seasonIndex * 19, 3.4) - 0.5) * 1.4;
          const ny = hash2(i * 2.91, seasonIndex * 11 + 5.2);
          const p = starSkyPoint(nx, ny, seasonIndex);
          positions.push(p.x, p.y, p.z);
        }
        // 夏季額外加入一道斜跨天空的銀河密集星帶。
        if (seasonIndex === 1) {
          for (let i = 0; i < 960; i++) {
            const t = hash2(i * 4.3, 12.7);
            const spread = (hash2(i * 8.1, 2.6) - 0.5) * 0.22;
            const p = starSkyPoint(
              -0.82 + t * 1.64 + spread,
              0.18 + t * 0.62 + spread,
              seasonIndex,
            );
            positions.push(p.x, p.y, p.z);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        const starMaterial = new THREE.PointsMaterial({
          color: config.color,
          size: seasonIndex === 3 ? 3.8 : 3.15,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          fog: false,
        });
        const stars = new THREE.Points(geometry, starMaterial);
        stars.renderOrder = -0.5;
        group.add(stars);

        let milkyWayMaterial = null;
        if (seasonIndex === 1) {
          milkyWayMaterial = new THREE.MeshBasicMaterial({
            map: MILKY_WAY_TEXTURE,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: true,
            fog: false,
            blending: THREE.AdditiveBlending,
          });
          const milkyWay = new THREE.Mesh(
            new THREE.PlaneGeometry(112, 19),
            milkyWayMaterial,
          );
          milkyWay.position.set(0, 1, -79);
          milkyWay.rotation.z = -0.31;
          milkyWay.renderOrder = -0.8;
          group.add(milkyWay);
        }

        // 抽約 1/7 星點做強烈十字星芒，分成五組錯開相位；底下原星點維持穩定亮度。
        const sparklePositions = Array.from({ length: 9 }, () => []);
        const sparkleColors = Array.from({ length: 9 }, () => []);
        for (let i = 0; i < positions.length / 3; i++) {
          if ((i + seasonIndex * 2) % 3 !== 0) continue;
          const phaseGroup = Math.floor(i / 3) % sparklePositions.length;
          sparklePositions[phaseGroup].push(
            positions[i * 3],
            positions[i * 3 + 1],
            positions[i * 3 + 2],
          );
          const color = new THREE.Color(
            STAR_SPARKLE_COLORS[
              (i * 3 + seasonIndex * 2) % STAR_SPARKLE_COLORS.length
            ],
          );
          sparkleColors[phaseGroup].push(color.r, color.g, color.b);
        }
        const sparkleMaterials = sparklePositions.map(
          (sparklePoints, phaseGroup) => {
            const sparkleGeometry = new THREE.BufferGeometry();
            sparkleGeometry.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(sparklePoints, 3),
            );
            sparkleGeometry.setAttribute(
              "color",
              new THREE.Float32BufferAttribute(sparkleColors[phaseGroup], 3),
            );
            const material = new THREE.PointsMaterial({
              color: 0xffffff,
              vertexColors: true,
              map: STAR_SPARKLE_TEXTURE,
              size: (seasonIndex === 3 ? 19 : 16.5) + (phaseGroup % 3) * 1.4,
              sizeAttenuation: false,
              transparent: true,
              opacity: 0,
              depthWrite: false,
              depthTest: true,
              fog: false,
              blending: THREE.AdditiveBlending,
            });
            const sparkle = new THREE.Points(sparkleGeometry, material);
            sparkle.renderOrder = -0.4 + phaseGroup * 0.01;
            group.add(sparkle);
            return material;
          },
        );

        group.userData.materials = [starMaterial];
        group.userData.sparkleMaterials = sparkleMaterials;
        group.userData.milkyWayMaterial = milkyWayMaterial;
        camera.add(group);
        return group;
      }
      for (let season = 0; season < 4; season++)
        seasonalStarGroups.push(makeSeasonStarGroup(season));

      // 流星是太空碎屑進入大氣後產生的光跡；本遊戲使用架空曆法安排流星雨日期。
      export const meteorLayer = new THREE.Group();
      meteorLayer.position.z = -72;
      camera.add(meteorLayer);
      export const meteorPool = [];
      export const METEOR_SEASON_STYLES = [
        { colors: [0xf2fff6, 0xffffff], length: 0.9, width: 1 },
        { colors: [0xdcecff, 0xffffff], length: 1.2, width: 1 },
        { colors: [0xffefc2, 0xfff8df], length: 1, width: 1 },
        { colors: [0xffffff, 0xe8f3ff], length: 0.92, width: 1.25 },
      ];
      export const METEOR_RADIANTS = [
        { x: -0.42, y: 0.72 },
        { x: 0.24, y: 0.78 },
        { x: 0.48, y: 0.66 },
        { x: -0.2, y: 0.8 },
      ];

      // METEOR_CONFIG 是 Object.freeze 過的常數，maxActive 永遠是這個數字；
      // 不能在這裡（模組頂層）讀 METEOR_CONFIG，理由跟上面 camera 用
      // INITIAL_ZOOM 取代 gameState.zoom 一樣——這裡也在 game-state.ts →
      // npc-runtime.ts/farm-visuals.ts → scene-sky.ts 的循環路徑上。
      const METEOR_POOL_SIZE = 20;
      for (let index = 0; index < METEOR_POOL_SIZE; index++) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(6), 3),
        );
        const material = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          blending: THREE.AdditiveBlending,
        });
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        line.renderOrder = -0.42;
        meteorLayer.add(line);
        meteorPool.push({ line, geometry, material, active: false, age: 0 });
      }

      export function getMeteorActivity() {
        if (!isOutdoorMap() || !isNightTime()) return null;
        const weatherFactor =
          {
            clear: 1,
            cloudy: 0.35,
            rain: 0,
            typhoon: 0,
            storm: 0,
            snow: 0.18,
            blizzard: 0,
          }[gameState.currentWeather] ?? 1;
        if (weatherFactor <= 0) return null;
        const shower = METEOR_SHOWER_SCHEDULE[getSeasonDay()] || null;
        return {
          shower,
          minPerHour:
            (shower?.minPerHour ?? METEOR_CONFIG.normalMinPerHour) *
            weatherFactor,
          maxPerHour:
            (shower?.maxPerHour ?? METEOR_CONFIG.normalMaxPerHour) *
            weatherFactor,
        };
      }

      export function getMeteorShowerHudLabel() {
        const shower = METEOR_SHOWER_SCHEDULE[getSeasonDay()];
        return shower
          ? `今晚：${METEOR_SHOWER_PHASE_NAMES[shower.phase] || "流星雨"}`
          : "";
      }

      export function scheduleNextMeteor(reset = false) {
        const activity = getMeteorActivity();
        if (!activity) {
          gameState.nextMeteorAt = Infinity;
          return;
        }
        if (reset) gameState.meteorBurstRemaining = 0;
        if (gameState.meteorBurstRemaining > 0) {
          gameState.meteorBurstRemaining--;
          gameState.nextMeteorAt = gameState.elapsed + 0.38 + Math.random() * 0.72;
          return;
        }
        if (!reset && activity.shower && gameState.elapsed >= gameState.meteorBurstCooldownUntil) {
          const burstChance =
            activity.shower.phase === "peak"
              ? 0.58
              : activity.shower.phase === "rising"
                ? 0.38
                : 0.24;
          if (Math.random() < burstChance) {
            gameState.meteorBurstRemaining =
              activity.shower.phase === "peak" && Math.random() < 0.55 ? 2 : 1;
            gameState.meteorBurstCooldownUntil = gameState.elapsed + 3.5 + Math.random() * 3;
            gameState.nextMeteorAt = gameState.elapsed + 0.38 + Math.random() * 0.72;
            return;
          }
        }
        const rate =
          activity.minPerHour +
          Math.random() * (activity.maxPerHour - activity.minPerHour);
        let interval;
        if (activity.shower?.phase === "peak") {
          interval = 1.35 + Math.random() * 1.55;
        } else {
          const eventsPerSecond = rate / TIME_CONFIG.realSecondsPerGameHour;
          interval =
            -Math.log(Math.max(0.0001, 1 - Math.random())) / eventsPerSecond;
          interval = Math.max(0.7, interval);
          // 保留不規則間隔，但流星雨提示日不讓極端亂數造成玩家久候卻看不到。
          if (activity.shower) {
            const maxShowerGap =
              activity.shower.phase === "approach"
                ? 10
                : activity.shower.phase === "rising"
                  ? 6.5
                  : 8;
            interval = Math.min(interval, maxShowerGap);
          }
        }
        gameState.nextMeteorAt = gameState.elapsed + interval;
      }

      export function spawnMeteor() {
        const slot = meteorPool.find((meteor) => !meteor.active);
        if (!slot) return false;
        const activity = getMeteorActivity();
        if (!activity) return false;
        const style = METEOR_SEASON_STYLES[gameState.currentSeason];
        const radiant = METEOR_RADIANTS[gameState.currentSeason];
        const showerMeteor = activity.shower && Math.random() < 0.82;
        // 使用相機目前的正交視錐，而不是寫死大範圍天空座標；如此預設 gameState.zoom=6
        // 與最小縮放都會把流星生成在玩家實際看得到的天空內。
        const viewWidth = camera.right - camera.left;
        const viewHeight = camera.top - camera.bottom;
        const marginX = Math.min(1.1, viewWidth * 0.08);
        const skyFloor = Math.max(0.8, camera.bottom + viewHeight * 0.58);
        const skyCeiling = camera.top - Math.min(0.45, viewHeight * 0.06);
        const radiantX = radiant.x * viewWidth * 0.5;
        const radiantY = skyFloor + (skyCeiling - skyFloor) * radiant.y;
        let startX;
        let startY;
        let angle;
        if (showerMeteor) {
          startX = radiantX + (Math.random() - 0.5) * viewWidth * 0.72;
          startY =
            radiantY + (Math.random() - 0.5) * (skyCeiling - skyFloor) * 0.72;
          startX = THREE.MathUtils.clamp(
            startX,
            camera.left + marginX,
            camera.right - marginX,
          );
          startY = THREE.MathUtils.clamp(startY, skyFloor, skyCeiling);
          const outwardX = startX - radiantX;
          const outwardY = startY - radiantY;
          angle = Math.atan2(outwardY, outwardX) + (Math.random() - 0.5) * 0.28;
        } else {
          startX =
            camera.left + marginX + Math.random() * (viewWidth - marginX * 2);
          startY = skyFloor + Math.random() * (skyCeiling - skyFloor);
          angle = -Math.PI * (0.08 + Math.random() * 0.72);
        }
        const speed = 18 + Math.random() * 17;
        const duration =
          METEOR_CONFIG.minDuration +
          Math.random() *
            (METEOR_CONFIG.maxDuration - METEOR_CONFIG.minDuration);
        slot.active = true;
        slot.age = 0;
        slot.duration =
          duration * (activity.shower ? METEOR_CONFIG.showerDurationScale : 1);
        slot.x = startX;
        slot.y = startY;
        slot.dx = Math.cos(angle);
        slot.dy = Math.sin(angle);
        slot.speed = speed;
        slot.length =
          (3.8 + Math.random() * 4.2) *
          style.length *
          (activity.shower ? METEOR_CONFIG.showerTrailScale : 1);
        slot.brightness = activity.shower
          ? 0.88 + Math.random() * 0.12
          : 0.62 + Math.random() * 0.28;
        slot.material.color.setHex(
          style.colors[Math.floor(Math.random() * style.colors.length)],
        );
        slot.material.opacity = 0;
        slot.material.linewidth = style.width * (0.85 + Math.random() * 0.3);
        slot.line.visible = true;
        return true;
      }

      export function clearMeteors() {
        meteorPool.forEach((meteor) => {
          meteor.active = false;
          meteor.line.visible = false;
          meteor.material.opacity = 0;
        });
        gameState.nextMeteorAt = Infinity;
        gameState.meteorBurstRemaining = 0;
      }

      export function updateMeteors(delta) {
        meteorLayer.visible = isOutdoorMap();
        if (!isOutdoorMap()) {
          clearMeteors();
          return;
        }
        const activity = getMeteorActivity();
        if (!activity) {
          clearMeteors();
          return;
        }
        if (!Number.isFinite(gameState.nextMeteorAt)) scheduleNextMeteor(true);
        if (gameState.elapsed >= gameState.nextMeteorAt) {
          spawnMeteor();
          scheduleNextMeteor();
        }
        meteorPool.forEach((meteor) => {
          if (!meteor.active) return;
          meteor.age += delta;
          if (meteor.age >= meteor.duration) {
            meteor.active = false;
            meteor.line.visible = false;
            meteor.material.opacity = 0;
            return;
          }
          meteor.x += meteor.dx * meteor.speed * delta;
          meteor.y += meteor.dy * meteor.speed * delta;
          const positions = meteor.geometry.attributes.position.array;
          positions[0] = meteor.x;
          positions[1] = meteor.y;
          positions[2] = 0;
          positions[3] = meteor.x - meteor.dx * meteor.length;
          positions[4] = meteor.y - meteor.dy * meteor.length;
          positions[5] = 0;
          meteor.geometry.attributes.position.needsUpdate = true;
          const progress = meteor.age / meteor.duration;
          const fadeIn = Math.min(1, progress / 0.14);
          const fadeOut = Math.min(1, (1 - progress) / 0.3);
          meteor.material.opacity =
            Math.min(fadeIn, fadeOut) * meteor.brightness;
        });
      }

      // 太陽/雲原本是硬邊的多邊形圓（CircleGeometry 直接當輪廓），沒有柔化，
      // 邊緣一圈鋸齒/銳利切線很明顯。用 canvas 畫一張白色放射狀漸層貼圖，
      // 讓 alpha 從中心到邊緣平滑衰減，套在同一批 mesh 上（不改頂點、不改
      // 動畫邏輯，material.color/opacity 照舊由 updateSunAndClouds 控制，
      // 貼圖只負責讓輪廓變柔），太陽變成有暈光的光球，雲變成蓬鬆的絮狀。
      export function makeRadialSpriteTexture(size, stops) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        const r = size / 2;
        const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
        stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
      }
      export const SUN_CORE_TEXTURE = makeRadialSpriteTexture(128, [
        [0, "rgba(255,255,255,1)"],
        [0.68, "rgba(255,255,255,0.98)"],
        [0.85, "rgba(255,255,255,0.7)"],
        [1, "rgba(255,255,255,0)"],
      ]);
      export const SUN_GLOW_TEXTURE = makeRadialSpriteTexture(128, [
        [0, "rgba(255,255,255,0.85)"],
        [0.3, "rgba(255,255,255,0.45)"],
        [0.65, "rgba(255,255,255,0.14)"],
        [1, "rgba(255,255,255,0)"],
      ]);
      export const CLOUD_LOBE_TEXTURE = makeRadialSpriteTexture(128, [
        [0, "rgba(255,255,255,1)"],
        [0.5, "rgba(255,255,255,0.95)"],
        [0.8, "rgba(255,255,255,0.5)"],
        [1, "rgba(255,255,255,0)"],
      ]);
      export const SUN_NOON_COLORS = [0xfff4d2, 0xfff0b0, 0xffd3a0, 0xe8f3ff];
      export const SUN_HORIZON_COLOR = new THREE.Color(0xff9b61);
      export const SUN_SKY_BLEND_COLOR = new THREE.Color();
      export const SUN_TARGET_COLOR = new THREE.Color();
      export const SUN_MASK_PROJECTED_POINT = new THREE.Vector3();
      export const sunSkyGroup = new THREE.Group();
      // 太陽位於相機遠端的天空層，但必須保留深度測試：天空球不寫入深度，
      // 太陽仍能顯示在天空；房屋、地形、角色與海岸等近景則會正確遮住太陽。
      export const sunGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffd796,
        map: SUN_GLOW_TEXTURE,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: false,
        blending: THREE.AdditiveBlending,
      });
      export const sunCoreMat = new THREE.MeshBasicMaterial({
        color: 0xfff4cc,
        map: SUN_CORE_TEXTURE,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: false,
      });
      export const sunGlow = new THREE.Mesh(
        new THREE.CircleGeometry(3.1, 32),
        sunGlowMat,
      );
      export const sunCore = new THREE.Mesh(
        new THREE.CircleGeometry(0.82, 28),
        sunCoreMat,
      );
      sunGlow.position.z = -0.04;
      sunGlow.renderOrder = -0.58;
      sunCore.renderOrder = -0.56;
      sunSkyGroup.add(sunGlow, sunCore);
      sunSkyGroup.position.z = -74;
      camera.add(sunSkyGroup);

      // 月亮——跟太陽同一套「掛在相機上的天空層」做法，差別是月核不是固定
      // 貼圖，而是每次換日依月相重畫一張 canvas（見 makeMoonPhaseTexture）。
      // 月出時間依月相往後移：新月時跟太陽同一時段升起(白天在天上、看不清)，
      // 滿月時整整移半天(太陽下山時升起、太陽升起時落下)，通宵可見。
      export function makeMoonPhaseTexture(size, t) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        const cx = size / 2,
          cy = size / 2,
          r = size / 2 - 2;
        // 暗面：不是全黑，留一點淡淡的底色，像地球反照
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(90,100,130,0.35)";
        ctx.fill();
        // 亮面：依月相裁出對應的月牙/凸月形狀。固定畫「頂→(左/右)→底」的
        // 半圓當外緣，再用一段橢圓(半寬 rx 隨月相從 0 到 r 變化)當終止線
        // 接回頂端；rx 的正負決定終止線要跟外緣同側(缺,月牙變窄)還是異側
        // (盈,月牙變寬到滿月)，兩種情況在 t=0.25/0.75 自然銜接。
        const cos = Math.cos(t * Math.PI * 2);
        const rx = Math.abs(cos) * r;
        const waxing = t < 0.5;
        const bulgeRight = waxing === (cos >= 0);
        ctx.beginPath();
        if (waxing) {
          ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); // 右半圓
        } else {
          ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true); // 左半圓
        }
        if (bulgeRight) {
          ctx.ellipse(cx, cy, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
        } else {
          ctx.ellipse(cx, cy, rx, r, 0, Math.PI / 2, Math.PI * 1.5, false);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255,250,235,0.98)";
        ctx.fill();
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
      }
      export const moonSkyGroup = new THREE.Group();
      export const moonGlowMat = new THREE.MeshBasicMaterial({
        color: 0xcdd8f2,
        map: SUN_GLOW_TEXTURE, // 共用太陽的放射狀漸層貼圖，只換顏色
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: false,
        blending: THREE.AdditiveBlending,
      });
      export const moonCoreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        fog: false,
      });
      export const moonGlow = new THREE.Mesh(
        new THREE.CircleGeometry(2.2, 32),
        moonGlowMat,
      );
      export const moonCore = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        moonCoreMat,
      );
      moonGlow.position.z = -0.04;
      moonGlow.renderOrder = -0.57;
      moonCore.renderOrder = -0.55;
      moonSkyGroup.add(moonGlow, moonCore);
      moonSkyGroup.position.z = -74;
      camera.add(moonSkyGroup);
      export function updateMoon() {
        if (!isOutdoorMap()) {
          moonSkyGroup.visible = false;
          return;
        }
        const daylight = getDaylightForSeason();
        const daySpan = daylight.sunset - daylight.sunrise;
        const moonAgeFraction =
          (gameState.currentDay % TIME_CONFIG.daysPerSeason) / TIME_CONFIG.daysPerSeason; // 0 新月 ~0.5 滿月
        if (gameState.moonPhaseTextureDay !== gameState.currentDay) {
          gameState.moonPhaseTextureDay = gameState.currentDay;
          if (moonCoreMat.map) moonCoreMat.map.dispose();
          moonCoreMat.map = makeMoonPhaseTexture(128, moonAgeFraction);
          moonCoreMat.needsUpdate = true;
        }
        const moonRiseFrac = (daylight.sunrise + moonAgeFraction) % 1;
        const deltaFromRise = (((gameState.currentPhase - moonRiseFrac) % 1) + 1) % 1;
        const aboveHorizon = deltaFromRise < daySpan;
        const moonProgress = deltaFromRise / daySpan;
        // 拋物線弧線(4t(1-t))取代原本的正弦：軌跡是真正的拋物線，兩端起落
        // 更利落、頂點更飽滿，看起來比正弦的「扁圓頂」更凸一點。
        const arc = aboveHorizon ? 4 * moonProgress * (1 - moonProgress) : 0;
        const illuminatedFraction =
          (1 - Math.cos(moonAgeFraction * Math.PI * 2)) / 2;
        const weatherMoonVisibility =
          {
            clear: 1,
            cloudy: 0.32,
            rain: 0.1,
            typhoon: 0,
            storm: 0,
            snow: 0.2,
            blizzard: 0.02,
          }[gameState.currentWeather] ?? 1;
        const moonOpacity = arc * illuminatedFraction * weatherMoonVisibility;
        moonSkyGroup.visible = moonOpacity > 0.005;
        if (!moonSkyGroup.visible) return;
        // 左右移動範圍縮窄(80→64)，同樣的高度在較窄的弧寬下視覺上更凸。
        moonSkyGroup.position.x = 32 - moonProgress * 64;
        moonSkyGroup.position.y = -5.5 + arc * daylight.peak * 0.5;
        // 跟太陽用同一招：把月亮所在 x 對應的北側懸崖投影到螢幕，低於地形
        // 輪廓時額外淡出，避免月亮掛在地形前面穿幫。
        const moonWorldX = gameState.player.position.x + moonSkyGroup.position.x;
        SUN_MASK_PROJECTED_POINT.set(
          moonWorldX,
          PLATEAU_Y + 0.35,
          northCliffEdgeZ(moonWorldX),
        ).project(camera);
        const terrainSkylineY = SUN_MASK_PROJECTED_POINT.y * gameState.zoom;
        const skyOnlyVisibility =
          gameState.currentMapName === "livingArea"
            ? THREE.MathUtils.smoothstep(
                moonSkyGroup.position.y - terrainSkylineY,
                0.15,
                1.15,
              )
            : 1;
        const finalOpacity = moonOpacity * skyOnlyVisibility;
        const horizonWarmth = Math.pow(1 - arc, 2.4);
        moonCoreMat.opacity = Math.min(1, finalOpacity * 1.3);
        moonGlowMat.opacity = finalOpacity * (0.3 + illuminatedFraction * 0.35);
        moonGlowMat.color
          .setHex(0xcdd8f2)
          .lerp(SUN_HORIZON_COLOR, horizonWarmth * 0.3);
        const pulse = 1 + Math.sin(gameState.effectElapsed * 0.5) * 0.01;
        moonGlow.scale.setScalar(pulse);
      }

      export const skyClouds = [];
      export const cloudLobeGeometry = new THREE.CircleGeometry(1, 18);
      for (let i = 0; i < 9; i++) {
        const cloud = new THREE.Group();
        // 雲位於相機遠端的天空層，但必須保留深度測試：天空球不寫入深度，
        // 所以雲仍會出現在天空；島嶼、人物、海岸等近景則會把雲正確遮住，
        // 避免雲穿過地形疊在遊戲畫面上。
        const material = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          map: CLOUD_LOBE_TEXTURE,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          fog: false,
        });
        const seed = hash2(i * 7.3, 18.4);
        // 原本每朵雲都用同一組固定的 4 顆橢圓，縮放/位置一樣，看起來像
        // 複製貼上。加 2 顆頂部小凸起、每顆再疊一點隨雲的 seed 決定性
        // 抖動的位置/縮放，每朵雲的輪廓才會長得不一樣，比較蓬鬆自然
        [
          [-1.45, -0.05, 1.25],
          [-0.45, 0.38, 1.55],
          [0.62, 0.24, 1.3],
          [1.45, -0.12, 0.92],
          [-0.05, 0.62, 0.85],
          [0.15, 0.58, 0.7],
        ].forEach(([x, y, scale], li) => {
          const j1 = hash2(seed * 13 + li * 4.1, li * 2.7) - 0.5;
          const j2 = hash2(li * 5.3, seed * 9 + li) - 0.5;
          const lobe = new THREE.Mesh(cloudLobeGeometry, material);
          lobe.position.set(x + j1 * 0.18, y + j2 * 0.14, li * -0.001);
          const s = scale * (0.9 + (j1 + j2) * 0.12);
          lobe.scale.set(s * 1.35, s * 0.72, 1);
          cloud.add(lobe);
        });
        // y 原本是 7~19，預設 gameState.zoom=6 的視錐只到 top=6，等於全部雲都在視野
        // 外，只有極端拉遠鏡頭才看得到。收到 2~5.5，貼著視錐上緣飄，一般
        // 遊玩的縮放程度就能看到
        cloud.position.set(
          -52 + seed * 104,
          2 + hash2(i, 3.7) * 3.5,
          -73.5 + i * 0.025,
        );
        cloud.scale.setScalar(0.72 + hash2(i, 9.2) * 0.75);
        cloud.userData = {
          baseX: cloud.position.x,
          baseY: cloud.position.y,
          material,
          seed,
        };
        camera.add(cloud);
        skyClouds.push(cloud);
      }

      export function updateSunAndClouds(nightFactor) {
        if (!isOutdoorMap()) {
          sunSkyGroup.visible = false;
          skyClouds.forEach((cloud) => (cloud.visible = false));
          return;
        }
        const daylight = getDaylightForSeason();
        const daySpan = daylight.sunset - daylight.sunrise;
        const sunProgress = (gameState.currentPhase - daylight.sunrise) / daySpan;
        const aboveHorizon = sunProgress > 0 && sunProgress < 1;
        // 跟月亮同一招：拋物線弧線取代正弦，頂點更飽滿、看起來更凸。
        const arc = aboveHorizon ? 4 * sunProgress * (1 - sunProgress) : 0;
        const weatherSunVisibility =
          {
            clear: 1,
            cloudy: 0.38,
            rain: 0.12,
            typhoon: 0,
            storm: 0,
            snow: 0.22,
            blizzard: 0.02,
          }[gameState.currentWeather] ?? 1;
        const sunOpacity = arc * weatherSunVisibility;
        sunSkyGroup.visible = sunOpacity > 0.005;
        if (sunSkyGroup.visible) {
          // 左右移動範圍縮窄(80→64)，同樣的高度在較窄的弧寬下視覺上更凸。
          sunSkyGroup.position.x = 32 - sunProgress * 64;
          // daylight.peak（13.5~21）是照原始設計拿來抓「太陽在天空中多高」的
          // 係數，但預設 gameState.zoom=6 時相機視錐只到 top=6，太陽升到接近中午
          // (arc 接近 1) 就會整個超出視錐範圍，等於中午前後太陽會直接消失。
          // 乘 0.5 把最高點壓到 gameState.zoom=6 也裝得下的範圍，四季相對高低差還在，
          // 只是整體矮一截
          sunSkyGroup.position.y = -5.5 + arc * daylight.peak * 0.5;
          // 太陽是掛在相機上的透明天空物件；只靠 depthTest，遇到不寫入深度的
          // 草地/透明特效仍可能穿透。把太陽所在 x 對應的北側懸崖投影到螢幕，
          // 低於地形輪廓時額外淡出，保證太陽只會留在真正的天空區域。
          const sunWorldX = gameState.player.position.x + sunSkyGroup.position.x;
          SUN_MASK_PROJECTED_POINT.set(
            sunWorldX,
            PLATEAU_Y + 0.35,
            northCliffEdgeZ(sunWorldX),
          ).project(camera);
          const terrainSkylineY = SUN_MASK_PROJECTED_POINT.y * gameState.zoom;
          const skyOnlyVisibility =
            gameState.currentMapName === "livingArea"
              ? THREE.MathUtils.smoothstep(
                  sunSkyGroup.position.y - terrainSkylineY,
                  0.15,
                  1.15,
                )
              : 1;
          if (skyOnlyVisibility <= 0.001) {
            sunSkyGroup.visible = false;
          }
          const horizonWarmth = Math.pow(1 - arc, 2.4);
          SUN_TARGET_COLOR.setHex(SUN_NOON_COLORS[gameState.currentSeason]).lerp(
            SUN_HORIZON_COLOR,
            horizonWarmth * 0.78,
          );
          SUN_SKY_BLEND_COLOR.copy(SKY_DAY_HORIZON)
            .lerp(SKY_DAY_ZENITH, 0.55)
            .lerp(SKY_NIGHT_HORIZON, nightFactor);
          sunCoreMat.color
            .copy(SUN_SKY_BLEND_COLOR)
            .lerp(SUN_TARGET_COLOR, Math.min(1, sunOpacity * 1.15));
          sunGlowMat.color
            .copy(SUN_SKY_BLEND_COLOR)
            .lerp(SUN_TARGET_COLOR, sunOpacity * (0.28 + arc * 0.16));
          sunCoreMat.opacity =
            Math.min(1, sunOpacity * 1.05) * skyOnlyVisibility;
          sunGlowMat.opacity =
            sunOpacity * (0.2 + arc * 0.16) * skyOnlyVisibility;
          const pulse = 1 + Math.sin(gameState.effectElapsed * 0.7) * 0.015;
          sunGlow.scale.setScalar(pulse);
        }

        const cloudCount =
          {
            clear: 3,
            cloudy: 8,
            rain: 9,
            typhoon: 9,
            storm: 9,
            snow: 8,
            blizzard: 9,
          }[gameState.currentWeather] ?? 3;
        const cloudOpacityByWeather = {
          clear: 0.18,
          cloudy: 0.52,
          rain: 0.68,
          typhoon: 0.78,
          storm: 0.82,
          snow: 0.62,
          blizzard: 0.76,
        };
        // 換天氣時雲量從「前一個天氣」的值淡到新天氣的值，不會瞬間變厚/變薄。
        const cloudOpacity = THREE.MathUtils.lerp(
          cloudOpacityByWeather[gameState.previousWeather] ?? 0.18,
          cloudOpacityByWeather[gameState.currentWeather] ?? 0.18,
          weatherTransitionRamp(),
        );
        const cloudSpeed =
          gameState.currentWeather === "typhoon"
            ? 5.8
            : gameState.currentWeather === "storm" || gameState.currentWeather === "blizzard"
              ? 3.8
              : gameState.currentWeather === "rain" || gameState.currentWeather === "snow"
                ? 1.6
                : 0.55;
        const cloudColor =
          gameState.currentWeather === "snow" || gameState.currentWeather === "blizzard"
            ? 0xdce8f1
            : gameState.currentWeather === "rain" ||
                gameState.currentWeather === "typhoon" ||
                gameState.currentWeather === "storm"
              ? 0x748395
              : gameState.currentSeason === 1
                ? 0xfff8e8
                : 0xf2f5f7;
        skyClouds.forEach((cloud, index) => {
          cloud.visible = index < cloudCount;
          if (!cloud.visible) return;
          const travel = cloud.userData.baseX + gameState.effectElapsed * cloudSpeed;
          cloud.position.x = -55 + ((((travel + 55) % 110) + 110) % 110);
          cloud.position.y =
            cloud.userData.baseY +
            Math.sin(gameState.effectElapsed * 0.08 + cloud.userData.seed * 12) * 0.32;
          cloud.userData.material.color.setHex(cloudColor);
          cloud.userData.material.opacity =
            cloudOpacity * (0.3 + (1 - nightFactor) * 0.7);
        });
      }

      export function updateSeasonalStars(nightFactor) {
        const outside = isOutdoorMap();
        const weatherVisibility =
          {
            clear: 1,
            cloudy: 0.38,
            rain: 0.18,
            typhoon: 0,
            storm: 0,
            snow: 0.45,
            blizzard: 0.03,
          }[gameState.currentWeather] ?? 1;
        const nightVisibility = Math.max(
          0,
          Math.min(1, (nightFactor - 0.38) / 0.5),
        );
        // 星空繞天頂的旋轉不能直接讀 currentPhase：那是每天 0 點準時從 0.999
        // 摔回 0 的鋸齒波，星星正掛在夜空中間時(0 點通常還在夜裡)會看到整片
        // 星空瞬間彈回去。改成以正午為分界的鋸齒波——正午太陽最亮、星空
        // opacity 本來就是 0，摔回去的瞬間沒人看得到。
        const noonWrappedElapsed =
          (((gameState.elapsed - dayLength / 2) % dayLength) + dayLength) %
          dayLength;
        const starPhase = noonWrappedElapsed / dayLength;
        seasonalStarGroups.forEach((group, seasonIndex) => {
          const visibility =
            outside && seasonIndex === gameState.currentSeason
              ? nightVisibility * weatherVisibility
              : 0;
          group.userData.materials[0].opacity = visibility * 0.92;
          if (group.userData.milkyWayMaterial) {
            group.userData.milkyWayMaterial.opacity = visibility * 0.88;
          }
          group.userData.sparkleMaterials.forEach((material, phaseIndex) => {
            const pulse = Math.max(
              0,
              Math.sin(
                gameState.effectElapsed * (1.42 + (phaseIndex % 3) * 0.17) +
                  (phaseIndex * Math.PI * 2) /
                    group.userData.sparkleMaterials.length +
                  seasonIndex * 0.7,
              ),
            );
            material.opacity =
              visibility * (0.045 + Math.pow(pulse, 4) * 0.955);
          });
          group.visible = visibility > 0.008;
          group.rotation.z = starPhase * 0.08 + seasonIndex * 0.012;
        });
      }
      export function updateSkyDome(nightFactor) {
        const outside = isOutdoorMap();
        skyDome.visible = outside;
        if (!outside) {
          updateSeasonalStars(nightFactor);
          updateSunAndClouds(nightFactor);
          updateMoon();
          return;
        }
        const zenith = SKY_DAY_ZENITH.clone().lerp(
          SKY_NIGHT_ZENITH,
          nightFactor,
        );
        const horizon = SKY_DAY_HORIZON.clone().lerp(
          SKY_NIGHT_HORIZON,
          nightFactor,
        );
        const middle = SKY_DAY_MID.clone().lerp(SKY_NIGHT_MID, nightFactor);
        const weatherShadeByWeather = {
          cloudy: 0.38,
          rain: 0.5,
          typhoon: 0.68,
          storm: 0.76,
          snow: 0.22,
          blizzard: 0.58,
        };
        // 跟雲量一樣，天色濃淡也從前一個天氣淡到新天氣，不瞬間變臉。
        const weatherShade = THREE.MathUtils.lerp(
          weatherShadeByWeather[gameState.previousWeather] || 0,
          weatherShadeByWeather[gameState.currentWeather] || 0,
          weatherTransitionRamp(),
        );
        const weatherSky =
          gameState.currentWeather === "snow" || gameState.currentWeather === "blizzard"
            ? new THREE.Color(0xb9c6d2)
            : new THREE.Color(0x667386);
        zenith.lerp(weatherSky, weatherShade);
        middle.lerp(weatherSky, weatherShade * 0.9);
        horizon.lerp(weatherSky, weatherShade * 0.78);
        const posAttr = skyGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const t = Math.max(0, posAttr.getY(i) / 85); // 0 地平線 ~1 天頂
          const lowerSky = t < 0.46;
          const blend = lowerSky ? t / 0.46 : (t - 0.46) / 0.54;
          const from = lowerSky ? horizon : middle;
          const to = lowerSky ? middle : zenith;
          skyColorAttr.setXYZ(
            i,
            from.r + (to.r - from.r) * blend,
            from.g + (to.g - from.g) * blend,
            from.b + (to.b - from.b) * blend,
          );
        }
        skyColorAttr.needsUpdate = true;
        skyDome.position.copy(camera.position);
        updateSeasonalStars(nightFactor);
        updateSunAndClouds(nightFactor);
        updateMoon();
      }

      // ==============================================================
