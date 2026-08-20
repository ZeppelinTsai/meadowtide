import { gameState, dayLength, getSeasonIndex, rollWeatherForSeason, SEASON_NAMES, WEATHER_NAMES, growCropsForNewDay } from "./game-state";
import { carpenterQuest, CARPENTER_CONSTRUCTION_DAYS, chefQuest, CHEF_RENOVATION_DAYS } from "./layout-maps";
import { updateAvenueTreeColors, updateSeasonalTreeColors, updateSeasonalGroundColors } from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import { scheduleNextMeteor } from "./scene-sky";
import { dialogEl } from "./dialogue";

export function beginNewDay(day) {
        gameState.currentSeason = getSeasonIndex(day);
        gameState.previousWeather = gameState.currentWeather;
        gameState.currentWeather = rollWeatherForSeason(gameState.currentSeason);
        gameState.weatherChangedAt = gameState.elapsed;
        updateAvenueTreeColors();
        updateSeasonalTreeColors();
        updateSeasonalGroundColors();
        if (
          carpenterQuest.stage === "construction" &&
          day - carpenterQuest.constructionStartDay >=
            CARPENTER_CONSTRUCTION_DAYS
        ) {
          carpenterQuest.stage = "ready_for_move_in";
        }
        if (
          chefQuest.stage === "renovating" &&
          day - chefQuest.renovatingStartDay >= CHEF_RENOVATION_DAYS
        ) {
          chefQuest.stage = "ready_for_move_in";
        }
        console.info(
          `[天氣] 第 ${day + 1} 天：${SEASON_NAMES[gameState.currentSeason]}季／${WEATHER_NAMES[gameState.currentWeather]}`,
        );
      }

      export function updateSeasonAndDate() {
        gameState.currentDay = Math.max(0, Math.floor(gameState.elapsed / dayLength));
        gameState.currentPhase =
          (((gameState.elapsed % dayLength) + dayLength) % dayLength) / dayLength;
        gameState.currentSeason = getSeasonIndex(gameState.currentDay);
      }

      export function isGameTimePaused() {
        const dialogOpen =
          typeof dialogEl !== "undefined" &&
          dialogEl.style.display !== "none" &&
          dialogEl.style.display !== "";
        const menuOpen = Boolean(
          document.querySelector('[data-game-menu="open"], .game-menu.open'),
        );
        return (
          document.hidden ||
          dialogOpen ||
          menuOpen ||
          (window as any).__gamePaused === true
        );
      }

      export function updateGameClock(delta) {
        if (!(delta > 0)) return 0;
        const oldDay = Math.floor(gameState.elapsed / dayLength);
        gameState.elapsed += delta;
        updateSeasonAndDate();
        const crossedDays = gameState.currentDay - oldDay;
        if (crossedDays > 0) {
          // 逐日處理，確保一般運行與快轉共用同一條事件路徑；不會漏日或重複觸發。
          for (let day = oldDay + 1; day <= gameState.currentDay; day++) {
            beginNewDay(day);
            growCropsForNewDay();
          }
          gameState.prevDay = gameState.currentDay;
          syncFarmVisuals();
          scheduleNextMeteor(true);
        }
        return crossedDays;
      }

      addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "n" && !e.repeat && !isGameTimePaused())
          updateGameClock(dayLength / 4);
      });
