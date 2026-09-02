import { gameState, dayLength, getSeasonIndex, rollWeatherForSeason, SEASON_NAMES, WEATHER_NAMES, growCropsForNewDay, growFlowerBedForNewDay } from "./game-state";
import { carpenterQuest, CARPENTER_CONSTRUCTION_DAYS, chefQuest, CHEF_RENOVATION_DAYS } from "./layout-maps";
import { updateAvenueTreeColors, updateSeasonalTreeColors, updateSeasonalGroundColors } from "./props";
import { syncFarmVisuals, syncFlowerBedVisuals } from "./farm-visuals";
import { scheduleNextMeteor } from "./scene-sky";
import { isWorldTimePaused } from "./time-pause";
import {
  dayTwoMorningEvent,
  DAY_TWO_MORNING_WINDOW_START,
  DAY_TWO_MORNING_WINDOW_END,
} from "./day2-morning-event";

export function beginNewDay(day) {
        gameState.currentSeason = getSeasonIndex(day);
        gameState.previousWeather = gameState.currentWeather;
        gameState.currentWeather = rollWeatherForSeason(gameState.currentSeason, day);
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
        return isWorldTimePaused();
      }

      // 每日 06:00 自動存檔的時間點——只是「這一幀跨過的 elapsed 區間」
      // 有沒有含到任一天的 06:00，不是比較 currentPhase 前後值(N 鍵快轉
      // 一次跳 6 小時，前後值可能剛好跨過又繞回來，比較 elapsed 絕對值
      // 才不會漏)。實際存檔動作在 game-loop.ts(見 gameState.pendingAutosave
      // 註解)，這裡只負責偵測、不直接呼叫 saveGame()——input-save.ts 已經
      // import 這個檔案的 updateGameClock()，這裡反過來 import
      // input-save.ts 會形成循環 import，是這個專案踩過的坑，見
      // scene-sky.ts 開頭那段說明。
      const AUTOSAVE_HOUR = 6;
      const AUTOSAVE_PHASE = AUTOSAVE_HOUR / 24;

      function crossedAutosaveMark(oldElapsed, newElapsed) {
        const base = dayLength * AUTOSAVE_PHASE;
        return (
          Math.floor((newElapsed - base) / dayLength) -
          Math.floor((oldElapsed - base) / dayLength)
        ) > 0;
      }

      // 2026-09-02 Zeppelin 反饋「避免強制事件被跳過」——道理跟上面
      // crossedAutosaveMark() 一樣：睡覺或 N 鍵快轉一次把 elapsed 瞬間
      // 往前跳一大段，中間不會有任何一幀落在 [8:00, 8:30) 窗口內，靠
      // day2-morning-event.ts 自己每幀輪詢 currentDay/currentPhase 的
      // canStartDayTwoMorningEvent() 永遠抓不到。這裡改成比較「這次前進
      // 的 elapsed 區間」有沒有含到窗口本身(用絕對 elapsed 起訖，不是
      // currentPhase 前後值)，含到就把 dayTwoMorningEvent.due 設成
      // true，交給 day2-morning-event.ts 自己決定何時真正觸發(要避開
      // dialogQueue/cutsceneActive 等畫面狀態)——跟
      // gameState.pendingAutosave 同一種「底層時鐘只負責標記、真正動作
      // 留給消費端」分工，這裡刻意不直接呼叫 startDayTwoMorningEvent()。
      function crossedDayTwoMorningWindow(oldElapsed, newElapsed) {
        return (
          newElapsed >= DAY_TWO_MORNING_WINDOW_START &&
          oldElapsed < DAY_TWO_MORNING_WINDOW_END
        );
      }

      export function updateGameClock(delta) {
        if (!(delta > 0)) return 0;
        const oldElapsed = gameState.elapsed;
        const oldDay = Math.floor(oldElapsed / dayLength);
        gameState.elapsed += delta;
        updateSeasonAndDate();
        const crossedDays = gameState.currentDay - oldDay;
        if (crossedDays > 0) {
          // 逐日處理，確保一般運行與快轉共用同一條事件路徑；不會漏日或重複觸發。
          for (let day = oldDay + 1; day <= gameState.currentDay; day++) {
            beginNewDay(day);
            growCropsForNewDay();
            growFlowerBedForNewDay();
          }
          gameState.prevDay = gameState.currentDay;
          syncFarmVisuals();
          syncFlowerBedVisuals();
          scheduleNextMeteor(true);
        }
        if (crossedAutosaveMark(oldElapsed, gameState.elapsed)) {
          gameState.pendingAutosave = true;
        }
        if (
          !dayTwoMorningEvent.triggered &&
          crossedDayTwoMorningWindow(oldElapsed, gameState.elapsed)
        ) {
          dayTwoMorningEvent.due = true;
        }
        return crossedDays;
      }

      addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "n" && !e.repeat && !isGameTimePaused())
          updateGameClock(dayLength / 4);
      });
