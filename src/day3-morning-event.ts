import { gameState, TIME_CONFIG, dayLength, isBeehiveUnlocked, unlockBeehive } from "./game-state";
import {
  DAY_THREE_BOTANIST_ARRIVAL,
  DAY_THREE_BEEHIVE_SCENE,
  botanistQuest,
} from "./layout-maps";
import { npcGroup, npcs } from "./npc-runtime";
import { loadMap } from "./build-map";
import { runBlackTransition } from "./loading-screen";
import { groundY } from "./scene-sky";
import { dialogQueue, showDialogSequence, systemDialog } from "./dialogue";
import { syncLastPlayerY } from "./prologue";
import { setTimePauseSource } from "./time-pause";
import { addAffectionReward } from "./affection";
import { announceHomeVisitorThenRun } from "./ui-toast";
import { FACING_ANGLE } from "./humanoid";

// ==============================================================
// 第三天早上劇本——克拉拉(植物學家)個人事件。Zeppelin 2026-09-04 給的
// 完整版：跟第二天「玩家去港口接歐文/露比」相反，這次是她主動上門拜訪
// 牧場，帶到蜂箱那塊空地聊完，直接架設蜂箱、解鎖 game-state.ts 早就
// 準備好的蜂箱/採蜜系統(見該檔案「蜂箱」那段開頭的說明——這個事件本身
// 就是那段註解裡提到「之後應該在事件結尾呼叫 unlockBeehive()」的那個
// 事件)。
//
// 跟 day2-morning-event.ts 的結構刻意保持一致(觸發窗口＋due旗標／
// announceHomeVisitorThenRun 預告／runBlackTransition 場景轉換／
// showDialogSequence 串接 callback／結尾 addAffectionReward)，但這次
// 只有克拉拉一個角色、全程沒有「自由採集」之類的中間態，所以沒有照搬
// dayTwoMorningEvent 那個泛用的 holding/holdPositions Record，改用
// layout-maps.ts 的 botanistQuest.scenePos 這個單一物件——game-loop.ts
// 讀這個值把她釘在對的座標，跟 artistQuest 那段「單一固定站位」寫法
// 同一種精神，只是站位會隨場次換(門口／蜂箱空地)，所以用一個會變動的
// 物件而不是常數。
//
// 蜂箱「簡易建造模式，玩家自己決定放哪」這段——這次先不做真正的自由
// 放置 UI：game-state.ts 的蜂箱系統本來就是固定站在 LAYOUT.beehive
// (28,39)(跟牡蠣架的「預先規劃好的養殖架位置」同一種設計，這個專案裡
// 目前所有「設施」都是這種寫法，不是自由放格子)，這裡忠實沿用，演出
// 上直接帶到那個定點、對話帶過「放這裡」的決定，不額外做拖曳/選格子
// 的介面——真的要做「玩家自己選格子放設施」的通用系統，是比這個事件
// 大很多的獨立功能，見 docs/decisions/day-three-botanist-event.md 的
// 說明。
// ==============================================================

// 窗口用絕對 elapsed 表示，跟 day2-morning-event.ts 的
// DAY_TWO_MORNING_WINDOW_START/END 同一套算法。2026-09-04 Zeppelin
// 調整：原本排在"第三天"10:00，改成提前到"第二天"接近尾聲的 15:00——
// 避免變成「每天早上固定巡兩隻村民」的公式化節奏(這正是 Zeppelin 原始
// 劇本裡自己吐槽的那個問題)。"第二天"顯示給玩家看是 currentDay+1(見
// save-slot-ui.ts 的 slotSummaryText())，currentDay 本身 0-indexed，
// 所以"第二天"＝currentDay===1，不是 0(那會變成"第一天")。檔名/變數
// 沿用 dayThree／DAY_THREE 前綴不改，避免牽動一整串既有匯出名稱，純粹
// 是命名跟劇情時間點暫時對不上，不影響行為。
export const DAY_THREE_MORNING_WINDOW_START = dayLength * (1 + 15 / 24);
export const DAY_THREE_MORNING_WINDOW_END = dayLength * (1 + 15.5 / 24);

// due 旗標的道理跟 dayTwoMorningEvent.due 完全一樣(見該處註解)：睡覺/N
// 鍵快轉一次跳過整個窗口時，靠 game-clock.ts 比較「這次前進的 elapsed
// 區間」有沒有含到窗口本身來補救。這裡不特別包一整個物件，單一個布林
// 值就夠，因為這個事件沒有 dayTwoMorningEvent 那些 phase/holding 等
// 需要跟著存讀檔的中途狀態——botanistQuest 自己已經有 stage 可以看。
export const dayThreeMorningEvent = { due: false };

export function canStartDayThreeMorningEvent(): boolean {
  if (botanistQuest.stage !== "not_started") return false;
  // 老存檔遷移(見 game-state.ts 蜂箱那段開頭註解)可能已經直接補上
  // beehive.unlocked，這種存檔不該再把這場戲重播一次。
  if (isBeehiveUnlocked()) return false;
  if (dialogQueue.length || gameState.cutsceneActive) return false;
  if (dayThreeMorningEvent.due) return true;
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  return gameState.currentDay === 1 && hour >= 15 && hour < 15.5;
}

// 存讀檔用：跟 resetDayTwoMorningEvent() 同一個理由——萬一存檔當下
// "botanistEvent" 這個時間暫停來源還卡在 true(存檔存在演出播到一半的
// 瞬間)，讀檔後要先清掉，不然時鐘會永遠卡住、窗口條件永遠等不到。
export function resetBotanistEvent() {
  setTimePauseSource("botanistEvent", false);
}

// ------ 對話行 helper：跟 day2-morning-event.ts 同一套 speaker/name
// 慣例，這裡不走 i18n，直接放繁中字串。------
const botanist = (
  text: string,
  revealNameAfter?: { npcId: string; stage: 1 },
) => ({
  text,
  speaker: "botanist",
  name: "克拉拉",
  revealNameAfter,
});
const hero = (text: string) => ({ text, speaker: "hero", name: "主角" });

// CG 場景用的 helper——跟 day2-morning-event.ts 的 repairCg/pigmentCg
// 同一招：spread 一份原本的對話行、疊上 cg id。setDialogCg() 偵測到
// currentCgId 從 -01 換成 -02 時，會自動走「差分轉場」那個半秒交叉淡
// 入淡出分支，不用額外處理轉場。主角在 CG 場景裡插話的短句(「……」/
// 「？」)也要照同一招疊上 cg，不然 setDialogCg(line.cg||null) 會被那句
// 沒帶 cg 的台詞打斷成 null，中間硬插一次淡出/淡入。
const hiveCg = (text: string) => ({ ...botanist(text), cg: "day3Botanist-01" });
const hiveCg2 = (text: string) => ({ ...botanist(text), cg: "day3Botanist-02" });
const heroHive = (text: string) => ({ ...hero(text), cg: "day3Botanist-01" });
const heroHive2 = (text: string) => ({ ...hero(text), cg: "day3Botanist-02" });

export function startDayThreeMorningEvent() {
  botanistQuest.stage = "intro"; // 立刻推進，防止 announceHomeVisitorThenRun 延遲期間重複觸發
  dayThreeMorningEvent.due = false;
  announceHomeVisitorThenRun(() => {
    gameState.cutsceneActive = true;
    setTimePauseSource("botanistEvent", true);
    loadMap("livingArea", DAY_THREE_BOTANIST_ARRIVAL.player, () => {
      syncLastPlayerY();
      // 面朝下(+Z)：atan2(0,1)+π=π，跟 day2 家門口那場的公式一致，
      // 面對站在自己南邊的克拉拉。
      gameState.player.rotation.y = Math.PI;
      const botanistNpc = npcs.find((n) => n.id === "botanist");
      if (botanistNpc) {
        npcGroup.visible = true;
        botanistNpc.mesh.visible = true;
        botanistNpc.mesh.position.set(
          DAY_THREE_BOTANIST_ARRIVAL.botanist.x,
          groundY(
            DAY_THREE_BOTANIST_ARRIVAL.botanist.x,
            DAY_THREE_BOTANIST_ARRIVAL.botanist.z,
          ),
          DAY_THREE_BOTANIST_ARRIVAL.botanist.z,
        );
        botanistNpc.mesh.rotation.y = 0; // 面朝上，對著玩家
        botanistNpc.path = null;
        botanistNpc.lastTargetKey = null;
      }
      botanistQuest.scenePos = {
        x: DAY_THREE_BOTANIST_ARRIVAL.botanist.x,
        z: DAY_THREE_BOTANIST_ARRIVAL.botanist.z,
        rotY: 0,
      };
      showDialogSequence(
        [
          "[敲門聲]",
          "[主角走出屋外]",
          "[一名陌生女子蹲在牧場邊，正在看地上的植物]",
          botanist("「早安。」"),
          "[她站起來，拍掉手套上的泥土]",
          botanist("「抱歉，一大早就來打擾你。」"),
          botanist(
            "「我是今天抵達島上的植物學家，克拉拉。」",
            { npcId: "botanist", stage: 1 },
          ),
          botanist("「村長跟我提過你，所以想先來打個招呼。」"),
          "[她看向牧場周圍]",
          botanist("「……順便看看這裡的環境。」"),
          hero("「？」"),
          botanist("「來的路上，我看到不少野花。」"),
          botanist("「山坡上的植被也比我原本預想的豐富。」"),
          "[看向玩家的田地]",
          botanist("「你才剛開始整理這裡吧？」"),
          "[主角點頭]",
          botanist("「那正好。」"),
          botanist("「我也想知道，這片土地現在還願意長出多少東西。」"),
          botanist("「方便帶我四處看看嗎？」"),
        ],
        startFlowerBedScene,
      );
    });
  });
}

// 帶去牧場邊的花叢——同一張地圖，不用整段黑屏傳送地圖，直接在原地短
// 黑幕過場重新站位就好，跟 day2-morning-event.ts Round 12 那次「趁黑
// 屏把村長直接送到廣場」是同一招(見 docs/decisions/day-two-morning-
// event.md 第十二輪)。這裡還沒解鎖蜂箱，蜂箱本身還不會出現在場景裡。
function startFlowerBedScene() {
  void runBlackTransition("short", () => {
    gameState.player.position.set(
      DAY_THREE_BEEHIVE_SCENE.player.x,
      groundY(DAY_THREE_BEEHIVE_SCENE.player.x, DAY_THREE_BEEHIVE_SCENE.player.z),
      DAY_THREE_BEEHIVE_SCENE.player.z,
    );
    gameState.player.rotation.y = FACING_ANGLE.right;
    syncLastPlayerY();
    const botanistNpc = npcs.find((n) => n.id === "botanist");
    if (botanistNpc) {
      botanistNpc.mesh.position.set(
        DAY_THREE_BEEHIVE_SCENE.botanist.x,
        groundY(
          DAY_THREE_BEEHIVE_SCENE.botanist.x,
          DAY_THREE_BEEHIVE_SCENE.botanist.z,
        ),
        DAY_THREE_BEEHIVE_SCENE.botanist.z,
      );
      botanistNpc.mesh.rotation.y = FACING_ANGLE.left;
      botanistNpc.path = null;
      botanistNpc.lastTargetKey = null;
    }
    botanistQuest.scenePos = {
      x: DAY_THREE_BEEHIVE_SCENE.botanist.x,
      z: DAY_THREE_BEEHIVE_SCENE.botanist.z,
      rotY: FACING_ANGLE.left,
    };
    showDialogSequence(
      [
        "[植物學家走到牧場邊的花叢，蹲下觀察]",
        botanist("「這裡的花比我想像中多。」"),
        botanist("「而且有蜜蜂。」"),
        hero("「？」"),
        botanist("「不用怕，只要不去招惹牠們，通常不會有事。」"),
        botanist("「牠們採集花蜜的同時，也會替許多植物傳播花粉。」"),
        "[一隻蜜蜂飛過]",
        botanist("「對植物來說，是很重要的鄰居。」"),
        "[她忽然想到什麼]",
        botanist("「……對了。」"),
        botanist("「我帶來的研究用品裡，剛好有一個蜂箱。」"),
        botanist("「本來想等安頓好再找地方架設。」"),
        "[看向牧場與花田]",
        botanist("「不過這裡好像挺適合。」"),
        botanist("「不如就架在這裡試試？」"),
        hero("「？」"),
        botanist("「可以給蜜蜂一個穩定的棲身處。」"),
        botanist("「如果蜂群適應得好，我們也能採收一些蜂蜜。」"),
        "[植物學家微笑]",
        botanist("「當然，得先留夠牠們自己吃的。」"),
        botanist("「蜂箱我已經準備好了，能幫我找個位置嗎？」"),
      ],
      revealBeehiveScene,
    );
  });
}

// 「放這裡」的決定——這裡直接呼叫 unlockBeehive()，再用 loadMap()
// 重建這張地圖(仍在 livingArea、座標不變，只是要讓 build-map.ts 那段
// `if (isBeehiveUnlocked()) plateauGroup.add(makeBeehive(...))` 重新
// 跑一次，蜂箱的 3D 模型才會真的加進場景——見 build-map.ts 該行旁的
// 說明，蜂箱模型只在 buildMap() 時檢查一次旗標，不是每幀動態開關)。
// 黑幕期間切換，玩家不會看到模型憑空生成的瞬間。
function revealBeehiveScene() {
  unlockBeehive();
  void runBlackTransition(
    "short",
    () =>
      new Promise<void>((resolve) => {
        loadMap("livingArea", DAY_THREE_BEEHIVE_SCENE.player, () => {
          syncLastPlayerY();
          gameState.player.rotation.y = FACING_ANGLE.right;
          const botanistNpc = npcs.find((n) => n.id === "botanist");
          if (botanistNpc) {
            botanistNpc.mesh.visible = true;
            botanistNpc.mesh.position.set(
              DAY_THREE_BEEHIVE_SCENE.botanist.x,
              groundY(
                DAY_THREE_BEEHIVE_SCENE.botanist.x,
                DAY_THREE_BEEHIVE_SCENE.botanist.z,
              ),
              DAY_THREE_BEEHIVE_SCENE.botanist.z,
            );
            botanistNpc.mesh.rotation.y = FACING_ANGLE.left;
            botanistNpc.path = null;
            botanistNpc.lastTargetKey = null;
          }
          botanistQuest.scenePos = {
            x: DAY_THREE_BEEHIVE_SCENE.botanist.x,
            z: DAY_THREE_BEEHIVE_SCENE.botanist.z,
            rotY: FACING_ANGLE.left,
          };
          syncLastPlayerY();
          showDialogSequence(
            [
              {
                ...systemDialog("蜂箱已經架設好了，之後可以定期採收蜂蜜"),
                cg: "day3Botanist-01",
              },
              hiveCg("「好了。」"),
              hiveCg("「接下來不用一直管牠們。」"),
              hiveCg("「附近有足夠的花，牠們自然會開始工作。」"),
              heroHive("「……」"),
              hiveCg("「怎麼？」"),
              "[主角看向蜂箱]",
              hiveCg("「想著什麼時候可以吃蜂蜜？」"),
              "[主角頭上冒出「！」]",
              hiveCg("「呵呵。」"),
              hiveCg("「先讓新鄰居住幾天吧。」"),
              "[植物學家確認了一下蜂箱的位置]",
              hiveCg("「這樣應該就可以了。」"),
              hiveCg("「之後我會偶爾過來看看蜂群的狀況。」"),
              "[她看向周圍的牧場]",
              hiveCg("「不過……」"),
              hiveCg("「這裡真的很有意思。」"),
              heroHive("「？」"),
              hiveCg("「荒廢了一段時間，卻不是什麼都沒有了。」"),
              hiveCg("「野花、昆蟲、草木……」"),
              hiveCg("「在人離開以後，牠們還是照自己的方式活了下來。」"),
              "[短暫停頓]",
              hiveCg("「所以我有點期待。」"),
              heroHive("「？」"),
              hiveCg("「等你開始照顧這片土地以後，它會變成什麼樣子。」"),
              "[她微笑]",
              hiveCg2("「好了，我今天就不繼續打擾你了。」"),
              hiveCg2("「我還想去山上看看。」"),
              hiveCg2("「對了。」"),
              hiveCg2("「山上也有不少蘑菇。」"),
              heroHive2("「！」"),
              hiveCg2("「放心，島上目前常見、可以採集的種類，我已經確認過了。」"),
              "[停頓]",
              hiveCg2("「但你要是發現一種連我都沒見過的……」"),
              heroHive2("「？」"),
              hiveCg2("「記得先拿來找我，不要直接丟進鍋裡。」"),
              heroHive2("「……」"),
              hiveCg2("「我不想搬來第三天，就多一份研究報告。」"),
              "[植物學家微笑著離開]",
              "[植物學家好感 +30]",
              "[個人事件完成]",
            ],
            completeBotanistEvent,
          );
          resolve();
        });
      }),
  );
}

function completeBotanistEvent() {
  addAffectionReward("botanist", "personalEvent");
  botanistQuest.stage = "complete";
  botanistQuest.scenePos = null;
  setTimePauseSource("botanistEvent", false);
  gameState.cutsceneActive = false;
}
