import * as THREE from "three";
import { hash2 } from "./utils";
import { scene } from "./scene-sky";
import { gameState, weatherTransitionRamp } from "./game-state";
import { INDOOR_MAPS, isOutdoorMap } from "./environment";
import { MAPS } from "./layout-maps";
import { isFirstPersonModeActive } from "./first-person-camera";
import {
  getTileGridWorldBounds,
  scaleCountForWorldBounds,
  type TileGridWorldBounds,
} from "./map-shift";

// 5.4) 低成本天氣粒子：雨線、雪片、春季櫻花，以及暴風雨閃電
      // ==============================================================
      export function makeSoftParticleTexture(shape = "round") {
        const canvas = document.createElement("canvas");
        const textureSize = shape === "petal" || shape === "leaf" ? 64 : 32;
        canvas.width = canvas.height = textureSize;
        const ctx = canvas.getContext("2d");
        if (shape === "petal") {
          ctx.translate(32, 32);
          ctx.rotate(-0.48);
          const gradient = ctx.createLinearGradient(-12, -25, 9, 24);
          gradient.addColorStop(0, "rgba(255,255,255,1)");
          gradient.addColorStop(0.52, "rgba(255,239,246,0.98)");
          gradient.addColorStop(1, "rgba(255,213,229,0.94)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(0, 25);
          ctx.bezierCurveTo(-15, 14, -19, -6, -10, -23);
          ctx.bezierCurveTo(-5, -29, -2, -20, 0, -14); // 花瓣頂端左瓣與凹口
          ctx.bezierCurveTo(2, -20, 5, -29, 10, -23);
          ctx.bezierCurveTo(19, -6, 15, 14, 0, 25);
          ctx.closePath();
          ctx.fill();
        } else if (shape === "leaf") {
          ctx.translate(32, 32);
          ctx.rotate(-0.68);
          const gradient = ctx.createLinearGradient(-18, -20, 18, 22);
          gradient.addColorStop(0, "rgba(255,174,70,1)");
          gradient.addColorStop(0.5, "rgba(220,72,42,0.98)");
          gradient.addColorStop(1, "rgba(133,35,35,0.94)");
          ctx.fillStyle = gradient;
          // 楓葉輪廓：頂尖 + 左右各三片尖裂葉，裂片間用凹角連接，
          // 不是原本那種光滑橢圓——遠看才會像楓葉而不是隨便一片葉子。
          ctx.beginPath();
          const mapleOutline: [number, number][] = [
            [0, -27],
            [5, -16],
            [15, -20],
            [11, -8],
            [23, -6],
            [12, 2],
            [17, 15],
            [5, 10],
            [3, 26],
            [0, 22],
            [-3, 26],
            [-5, 10],
            [-17, 15],
            [-12, 2],
            [-23, -6],
            [-11, -8],
            [-15, -20],
            [-5, -16],
          ];
          mapleOutline.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fill();
        } else {
          const gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 13);
          gradient.addColorStop(0, "rgba(255,255,255,1)");
          gradient.addColorStop(0.45, "rgba(255,255,255,0.82)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 32, 32);
        }
        const texture = new THREE.CanvasTexture(canvas);
        if (shape === "petal" || shape === "leaf") {
          // 避免透明像素的黑色 RGB 在縮放取樣時滲入花瓣邊緣，形成假描邊。
          texture.premultiplyAlpha = true;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
        }
        return texture;
      }
      export const WEATHER_PADDING = 10;
      export const BASE_WEATHER_AREA = 95 * 120;
      const outdoorMapNames = (Object.keys(MAPS) as Array<keyof typeof MAPS>).filter(
        (mapName) => !INDOOR_MAPS.has(mapName),
      );
      export function weatherBoundsForMap(mapName = gameState.currentMapName) {
        const map = MAPS[mapName] ?? MAPS.livingArea;
        return getTileGridWorldBounds(map.tiles, WEATHER_PADDING);
      }
      export const WEATHER_BOUNDS: TileGridWorldBounds = weatherBoundsForMap();
      const maxWeatherParticleCapacity = (baseCount: number) =>
        Math.max(
          ...outdoorMapNames.map((mapName) =>
            scaleCountForWorldBounds(
              baseCount,
              weatherBoundsForMap(mapName),
              BASE_WEATHER_AREA,
            ),
          ),
        );
      const activeWeatherParticleCount = (baseCount: number) =>
        scaleCountForWorldBounds(
          baseCount,
          WEATHER_BOUNDS,
          BASE_WEATHER_AREA,
        );
      export const weatherEffectGroup = new THREE.Group();
      scene.add(weatherEffectGroup);

      export const MAX_RAIN_DROPS = maxWeatherParticleCapacity(360);
      export const rainPositions = new Float32Array(MAX_RAIN_DROPS * 6);
      export const rainSeeds = new Float32Array(MAX_RAIN_DROPS);
      for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        rainSeeds[i] = hash2(i * 4.17, 8.3);
        rainPositions[i * 6] = rainPositions[i * 6 + 3] =
          WEATHER_BOUNDS.minX +
          hash2(i, 2.1) * (WEATHER_BOUNDS.maxX - WEATHER_BOUNDS.minX);
        rainPositions[i * 6 + 1] =
          WEATHER_BOUNDS.minY +
          hash2(i, 7.9) * (WEATHER_BOUNDS.maxY - WEATHER_BOUNDS.minY);
        rainPositions[i * 6 + 4] = rainPositions[i * 6 + 1] - 0.65;
        rainPositions[i * 6 + 2] = rainPositions[i * 6 + 5] =
          WEATHER_BOUNDS.minZ +
          hash2(i, 12.3) * (WEATHER_BOUNDS.maxZ - WEATHER_BOUNDS.minZ);
      }
      export const rainGeometry = new THREE.BufferGeometry();
      rainGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(rainPositions, 3),
      );
      export const rainMaterial = new THREE.LineBasicMaterial({
        color: 0xaed5ef,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
      });
      export const rainEffect = new THREE.LineSegments(rainGeometry, rainMaterial);
      rainEffect.renderOrder = 10;
      rainEffect.frustumCulled = false;
      weatherEffectGroup.add(rainEffect);

      export function makeWeatherPointLayer(count, color, size, texture) {
        const positions = new Float32Array(count * 3);
        const seeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          seeds[i] = hash2(i * 5.31, count * 0.17);
          positions[i * 3] =
            WEATHER_BOUNDS.minX +
            hash2(i, 1.7) * (WEATHER_BOUNDS.maxX - WEATHER_BOUNDS.minX);
          positions[i * 3 + 1] =
            WEATHER_BOUNDS.minY +
            hash2(i, 6.4) * (WEATHER_BOUNDS.maxY - WEATHER_BOUNDS.minY);
          positions[i * 3 + 2] =
            WEATHER_BOUNDS.minZ +
            hash2(i, 11.8) * (WEATHER_BOUNDS.maxZ - WEATHER_BOUNDS.minZ);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        const material = new THREE.PointsMaterial({
          color,
          size,
          map: texture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: false,
        });
        const points = new THREE.Points(geometry, material);
        points.renderOrder = 10;
        points.frustumCulled = false;
        weatherEffectGroup.add(points);
        return { points, geometry, material, positions, seeds, count };
      }
      export function makePetalLayer(count, color, size, texture, color2 = color) {
        const positions = new Float32Array(count * 3);
        const seeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          seeds[i] = hash2(i * 5.31, count * 0.17);
          positions[i * 3] =
            WEATHER_BOUNDS.minX +
            hash2(i, 1.7) * (WEATHER_BOUNDS.maxX - WEATHER_BOUNDS.minX);
          positions[i * 3 + 1] =
            WEATHER_BOUNDS.minY +
            hash2(i, 6.4) * (WEATHER_BOUNDS.maxY - WEATHER_BOUNDS.minY);
          positions[i * 3 + 2] =
            WEATHER_BOUNDS.minZ +
            hash2(i, 11.8) * (WEATHER_BOUNDS.maxZ - WEATHER_BOUNDS.minZ);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3),
        );
        geometry.setAttribute("petalSeed", new THREE.BufferAttribute(seeds, 1));
        const tint = new THREE.Color(color);
        const tint2 = new THREE.Color(color2);
        const material = new THREE.ShaderMaterial({
          uniforms: {
            petalMap: { value: texture },
            tint: { value: tint },
            tint2: { value: tint2 },
            opacity: { value: 0 },
            time: { value: 0 },
            pointSize: { value: size },
          },
          vertexShader: `
      attribute float petalSeed;
      uniform float time; uniform float pointSize;
      varying float vAngle; varying float vFlip; varying float vSeed;
      void main(){
        float phase=time*(0.65+petalSeed*1.55)+petalSeed*24.0;
        vAngle=phase*0.72+sin(phase*0.47)*1.15;
        vFlip=cos(phase*1.36);
        vSeed=petalSeed;
        gl_PointSize=pointSize*(0.84+0.16*sin(phase*0.81));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
          fragmentShader: `
      uniform sampler2D petalMap; uniform vec3 tint; uniform vec3 tint2; uniform float opacity;
      varying float vAngle; varying float vFlip; varying float vSeed;
      void main(){
        vec2 p=gl_PointCoord-0.5;
        float c=cos(vAngle), s=sin(vAngle);
        p=mat2(c,-s,s,c)*p;
        float width=max(0.16,abs(vFlip));
        p.x/=width;
        if(vFlip<0.0) p.x=-p.x;
        vec2 uv=p+0.5;
        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) discard;
        vec4 tex=texture2D(petalMap,uv);
        if(tex.a<0.055) discard;
        // 每片葉子/花瓣用自己的亂數種子在兩個色號之間取值，同一層裡的顆粒
        // 才不會全部長得一模一樣的顏色。
        vec3 particleTint=mix(tint,tint2,vSeed);
        gl_FragColor=vec4(tex.rgb*particleTint,tex.a*opacity);
      }`,
          transparent: true,
          depthWrite: false,
          depthTest: true,
        });
        const points = new THREE.Points(geometry, material);
        points.renderOrder = 10;
        points.frustumCulled = false;
        weatherEffectGroup.add(points);
        return { points, geometry, material, positions, seeds, count };
      }
      const SNOW_BASE_COUNT = 260;
      const PETAL_BASE_COUNTS = [360, 140] as const;
      const AUTUMN_LEAF_BASE_COUNTS = [210, 75] as const;
      export const snowEffect = makeWeatherPointLayer(
        maxWeatherParticleCapacity(SNOW_BASE_COUNT),
        0xf4f8ff,
        6.5,
        makeSoftParticleTexture(),
      );
      export const petalTexture = makeSoftParticleTexture("petal");
      export const petalEffect = makePetalLayer(
        maxWeatherParticleCapacity(PETAL_BASE_COUNTS[0]),
        0xfffbfd,
        13.5,
        petalTexture,
      );
      export const petalForegroundEffect = makePetalLayer(
        maxWeatherParticleCapacity(PETAL_BASE_COUNTS[1]),
        0xffedf4,
        20,
        petalTexture,
      );
      export const autumnLeafTexture = makeSoftParticleTexture("leaf");
      // 每片楓葉在這兩個色號之間隨機取色(靠 petalSeed)，同一批飄落的葉子
      // 才會有金黃到棕紅的深淺差異，不是全部同一個顏色。
      export const autumnLeafEffect = makePetalLayer(
        maxWeatherParticleCapacity(AUTUMN_LEAF_BASE_COUNTS[0]),
        0xffd27a,
        12.5,
        autumnLeafTexture,
        0xb8452e,
      );
      export const autumnLeafForegroundEffect = makePetalLayer(
        maxWeatherParticleCapacity(AUTUMN_LEAF_BASE_COUNTS[1]),
        0xffab5c,
        18,
        autumnLeafTexture,
        0x8f3323,
      );
      let weatherBoundsKey = "";
      function distributeRainAcrossBounds(bounds: TileGridWorldBounds) {
        for (let i = 0; i < MAX_RAIN_DROPS; i++) {
          const base = i * 6;
          const x = bounds.minX + hash2(i, 2.1) * (bounds.maxX - bounds.minX);
          const y = bounds.minY + hash2(i, 7.9) * (bounds.maxY - bounds.minY);
          const z = bounds.minZ + hash2(i, 12.3) * (bounds.maxZ - bounds.minZ);
          rainPositions[base] = rainPositions[base + 3] = x;
          rainPositions[base + 1] = y;
          rainPositions[base + 4] = y - 0.65;
          rainPositions[base + 2] = rainPositions[base + 5] = z;
        }
        rainGeometry.attributes.position.needsUpdate = true;
      }
      function distributePointLayerAcrossBounds(layer, bounds: TileGridWorldBounds) {
        for (let i = 0; i < layer.count; i++) {
          const base = i * 3;
          layer.positions[base] =
            bounds.minX + hash2(i, 1.7) * (bounds.maxX - bounds.minX);
          layer.positions[base + 1] =
            bounds.minY + hash2(i, 6.4) * (bounds.maxY - bounds.minY);
          layer.positions[base + 2] =
            bounds.minZ + hash2(i, 11.8) * (bounds.maxZ - bounds.minZ);
        }
        layer.geometry.attributes.position.needsUpdate = true;
      }
      export function syncWeatherBoundsToCurrentMap(force = false) {
        const map = MAPS[gameState.currentMapName] ?? MAPS.livingArea;
        const key = `${gameState.currentMapName}:${map.tiles[0]?.length ?? 0}x${map.tiles.length}`;
        if (!force && key === weatherBoundsKey) return;
        Object.assign(WEATHER_BOUNDS, weatherBoundsForMap(gameState.currentMapName));
        distributeRainAcrossBounds(WEATHER_BOUNDS);
        [
          snowEffect,
          petalEffect,
          petalForegroundEffect,
          autumnLeafEffect,
          autumnLeafForegroundEffect,
        ].forEach((layer) => distributePointLayerAcrossBounds(layer, WEATHER_BOUNDS));
        weatherBoundsKey = key;
      }
      export const weatherFlashLight = new THREE.HemisphereLight(
        0xeaf3ff,
        0x65758b,
        0,
      );
      scene.add(weatherFlashLight);

      export function wrapWeatherParticle(value, min, max) {
        if (value < min) return max;
        if (value > max) return min;
        return value;
      }
      export function updateWeatherEffects(dt, nightFactor) {
        const outside = isOutdoorMap();
        if (outside) syncWeatherBoundsToCurrentMap();
        weatherEffectGroup.visible = outside;
        if (!outside) {
          weatherFlashLight.intensity = 0;
          return;
        }
        // 第一人稱靠近海面時，粒子不能再用 terrain floor 當最低點，
        // 否則會被壓到海平線附近，像是卡在遠海地面上。
        const lowerWeatherFloor = isFirstPersonModeActive()
          ? Math.max(WEATHER_BOUNDS.minY + 2.4, 2.4)
          : WEATHER_BOUNDS.minY;
        const rainMode =
          gameState.currentWeather === "rain" ||
          gameState.currentWeather === "typhoon" ||
          gameState.currentWeather === "storm";
        const rainBaseCount =
          gameState.currentWeather === "rain"
            ? 190
            : gameState.currentWeather === "typhoon"
              ? 360
              : gameState.currentWeather === "storm"
                ? 300
                : 0;
        const rainCount = activeWeatherParticleCount(rainBaseCount);
        const rainDrift =
          gameState.currentWeather === "typhoon"
            ? 13
            : gameState.currentWeather === "storm"
              ? 7
              : 2;
        rainEffect.visible = rainMode;
        if (rainMode) {
          rainGeometry.setDrawRange(0, rainCount * 2);
          rainMaterial.opacity =
            (gameState.currentWeather === "rain" ? 0.52 : 0.72) * weatherTransitionRamp();
          for (let i = 0; i < rainCount; i++) {
            const base = i * 6,
              speed = 14 + rainSeeds[i] * 10;
            let x = rainPositions[base] + rainDrift * dt;
            let y = rainPositions[base + 1] - speed * dt;
            x = wrapWeatherParticle(
              x,
              WEATHER_BOUNDS.minX,
              WEATHER_BOUNDS.maxX,
            );
            y = wrapWeatherParticle(
              y,
              lowerWeatherFloor,
              WEATHER_BOUNDS.maxY,
            );
            const slant = rainDrift * 0.055,
              length = gameState.currentWeather === "rain" ? 0.62 : 0.95;
            rainPositions[base] = x;
            rainPositions[base + 1] = y;
            // 雨滴往 +X、-Y 移動，線段也要指向同一個下風方向。
            rainPositions[base + 3] = x + slant;
            rainPositions[base + 4] = y - length;
          }
          rainGeometry.attributes.position.needsUpdate = true;
        }

        const snowMode =
          gameState.currentWeather === "snow" || gameState.currentWeather === "blizzard";
        snowEffect.points.visible = snowMode;
        if (snowMode) {
          const snowCount = activeWeatherParticleCount(SNOW_BASE_COUNT);
          snowEffect.geometry.setDrawRange(0, snowCount);
          snowEffect.material.opacity =
            (gameState.currentWeather === "blizzard" ? 0.9 : 0.72) *
            weatherTransitionRamp();
          snowEffect.material.size = gameState.currentWeather === "blizzard" ? 7.5 : 6.5;
          for (let i = 0; i < snowCount; i++) {
            const base = i * 3,
              seed = snowEffect.seeds[i];
            snowEffect.positions[base] = wrapWeatherParticle(
              snowEffect.positions[base] +
                ((gameState.currentWeather === "blizzard" ? 10 : 1.2) +
                  Math.sin(gameState.effectElapsed * 1.4 + seed * 20)) *
                  dt,
              WEATHER_BOUNDS.minX,
              WEATHER_BOUNDS.maxX,
            );
            snowEffect.positions[base + 1] = wrapWeatherParticle(
              snowEffect.positions[base + 1] -
                (gameState.currentWeather === "blizzard" ? 5.2 : 1.4 + seed) * dt,
              lowerWeatherFloor,
              WEATHER_BOUNDS.maxY,
            );
          }
          snowEffect.geometry.attributes.position.needsUpdate = true;
        }

        const petalsVisible =
          gameState.currentSeason === 0 &&
          (gameState.currentWeather === "clear" || gameState.currentWeather === "cloudy");
        petalEffect.points.visible = petalsVisible;
        petalForegroundEffect.points.visible = petalsVisible;
        if (petalsVisible) {
          petalEffect.material.uniforms.opacity.value =
            gameState.currentWeather === "cloudy" ? 0.76 : 0.9;
          petalForegroundEffect.material.uniforms.opacity.value =
            gameState.currentWeather === "cloudy" ? 0.7 : 0.86;
          [petalEffect, petalForegroundEffect].forEach((layer, layerIndex) => {
            const layerCount = activeWeatherParticleCount(PETAL_BASE_COUNTS[layerIndex]);
            layer.geometry.setDrawRange(0, layerCount);
            layer.material.uniforms.time.value = gameState.effectElapsed;
            for (let i = 0; i < layerCount; i++) {
              const base = i * 3,
                seed = layer.seeds[i];
              const swirl =
                Math.sin(
                  gameState.effectElapsed * (0.72 + seed * 0.55) +
                    seed * 19 +
                    layerIndex,
                ) *
                (0.55 + layerIndex * 0.35);
              layer.positions[base] = wrapWeatherParticle(
                layer.positions[base] + (0.7 + swirl) * dt,
                WEATHER_BOUNDS.minX,
                WEATHER_BOUNDS.maxX,
              );
              layer.positions[base + 1] = wrapWeatherParticle(
                layer.positions[base + 1] -
                  (0.5 +
                    seed * 0.68 +
                    Math.sin(gameState.effectElapsed * 1.15 + seed * 13) * 0.18) *
                    dt,
                lowerWeatherFloor,
                WEATHER_BOUNDS.maxY,
              );
            }
            layer.geometry.attributes.position.needsUpdate = true;
          });
        }

        const autumnLeavesVisible =
          gameState.currentSeason === 2 &&
          (gameState.currentWeather === "clear" || gameState.currentWeather === "cloudy");
        autumnLeafEffect.points.visible = autumnLeavesVisible;
        autumnLeafForegroundEffect.points.visible = autumnLeavesVisible;
        if (autumnLeavesVisible) {
          autumnLeafEffect.material.uniforms.opacity.value =
            gameState.currentWeather === "cloudy" ? 0.72 : 0.88;
          autumnLeafForegroundEffect.material.uniforms.opacity.value =
            gameState.currentWeather === "cloudy" ? 0.66 : 0.82;
          [autumnLeafEffect, autumnLeafForegroundEffect].forEach(
            (layer, layerIndex) => {
              const layerCount = activeWeatherParticleCount(
                AUTUMN_LEAF_BASE_COUNTS[layerIndex],
              );
              layer.geometry.setDrawRange(0, layerCount);
              layer.material.uniforms.time.value = gameState.effectElapsed * 0.86;
              for (let i = 0; i < layerCount; i++) {
                const base = i * 3,
                  seed = layer.seeds[i];
                const gust =
                  Math.sin(gameState.effectElapsed * (0.48 + seed * 0.7) + seed * 23) *
                  (0.75 + layerIndex * 0.4);
                layer.positions[base] = wrapWeatherParticle(
                  layer.positions[base] + (0.42 + gust) * dt,
                  WEATHER_BOUNDS.minX,
                  WEATHER_BOUNDS.maxX,
                );
                layer.positions[base + 1] = wrapWeatherParticle(
                  layer.positions[base + 1] -
                    (0.7 +
                      seed * 0.85 +
                      Math.sin(gameState.effectElapsed + seed * 17) * 0.2) *
                      dt,
                  lowerWeatherFloor,
                  WEATHER_BOUNDS.maxY,
                );
              }
              layer.geometry.attributes.position.needsUpdate = true;
            },
          );
        }
        const flashWave =
          gameState.currentWeather === "storm"
            ? Math.pow(
                Math.max(
                  0,
                  Math.sin(
                    gameState.effectElapsed * 0.73 + Math.sin(gameState.effectElapsed * 0.19) * 2.1,
                  ),
                ),
                34,
              )
            : 0;
        weatherFlashLight.intensity =
          flashWave * (nightFactor > 0.45 ? 2.8 : 1.5) * weatherTransitionRamp();
      }
