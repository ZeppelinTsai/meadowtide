import { TIME_CONFIG, dayLength, gameState, unlockOysterFarming } from "./game-state";
import {
  DAY_THREE_BOTANIST_ARRIVAL,
  oceanographerQuest,
  OCEANOGRAPHER_COAST_SCENE,
} from "./layout-maps";
import { npcs, npcGroup } from "./npc-runtime";
import { loadMap } from "./build-map";
import { runBlackTransition } from "./loading-screen";
import { groundY } from "./scene-sky";
import { dialogQueue, showDialogSequence, systemDialog } from "./dialogue";
import { syncLastPlayerY } from "./prologue";
import { setTimePauseSource } from "./time-pause";
import { addAffectionReward } from "./affection";
import { announceHomeVisitorThenRun } from "./ui-toast";
import { FACING_ANGLE } from "./humanoid";
import { botanistQuest } from "./layout-maps";
import { lockEventClock } from "./event-clock";

export const OCEANOGRAPHER_EVENT_WINDOW_START = dayLength * (2 + 14 / 24);
export const OCEANOGRAPHER_EVENT_WINDOW_END = dayLength * (2 + 16 / 24);
export const oceanographerEvent = { due: false };
const DAY_THREE_EVENT_DAY = 2;
const OCEANOGRAPHER_EVENT_START_HOUR = 14;
const OCEANOGRAPHER_EVENT_END_HOUR = 16;

const marine = (text: string, revealNameAfter?: { npcId: string; stage: 1 }) => ({
  text,
  speaker: "marine_biologist",
  name: "傑米",
  revealNameAfter,
});
const hero = (text: string) => ({ text, speaker: "hero", name: "主角" });
const marineCg = (text: string) => ({ ...marine(text), cg: "day3Oceanographer-01" });
const heroCg = (text: string) => ({ ...hero(text), cg: "day3Oceanographer-01" });

export function canStartOceanographerEvent() {
  if (oceanographerQuest.stage !== "not_started") return false;
  if (botanistQuest.stage !== "complete") return false;
  if (dialogQueue.length || gameState.cutsceneActive) return false;
  if (oceanographerEvent.due) return true;
  const hour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  return gameState.currentDay === 2 && hour >= 14 && hour < 16;
}

export function resetOceanographerEvent() {
  oceanographerEvent.due = false;
  setTimePauseSource("oceanographerEvent", false);
}

function placeOceanographer(x: number, z: number, rotY: number) {
  const npc = npcs.find((entry) => entry.id === "marine_biologist");
  if (!npc) return;
  npcGroup.visible = true;
  npc.mesh.visible = true;
  npc.mesh.position.set(x, groundY(x, z), z);
  npc.mesh.rotation.y = rotY;
  oceanographerQuest.scenePos = { x, z, rotY };
}

export function startOceanographerEvent() {
  lockEventClock(DAY_THREE_EVENT_DAY, OCEANOGRAPHER_EVENT_START_HOUR);
  oceanographerQuest.stage = "intro";
  oceanographerEvent.due = false;
  announceHomeVisitorThenRun(() => {
    gameState.cutsceneActive = true;
    setTimePauseSource("oceanographerEvent", true);
    loadMap("livingArea", DAY_THREE_BOTANIST_ARRIVAL.player, () => {
      syncLastPlayerY();
      gameState.player.rotation.y = Math.PI;
      placeOceanographer(
        DAY_THREE_BOTANIST_ARRIVAL.botanist.x,
        DAY_THREE_BOTANIST_ARRIVAL.botanist.z,
        0,
      );
      showDialogSequence(
        [
          "[主角回到牧場]",
          "[遠處有人沿著道路走來]",
          "[海洋學家背著研究器材，手上拿著採樣瓶]",
          marine("「你好。」"),
          hero("「？」"),
          marine("「我是今天剛搬來的。」"),
          marine("「海洋學家，傑米。」", { npcId: "marine_biologist", stage: 1 }),
          "[海洋學家正式登場]",
          "[他環視牧場，很快注意到花田旁剛設好的蜂箱]",
          marine("「那是蜂箱？」"),
          "[主角點頭]",
          marine("「看來植物學家已經來過了。」"),
          marine("「她動作真快。」"),
          "[他看向遠處的海]",
          marine("「我原本只是來打聲招呼。不過正好。」"),
          hero("「？」"),
          marine("「我有一組設備想設在近岸。」"),
          marine("「可以借我一點時間嗎？」"),
          "[海洋學家進入同行狀態]",
        ],
        moveToCoast,
      );
    });
  });
}

function moveToCoast() {
  void runBlackTransition("short", () => {
    gameState.player.position.set(
      OCEANOGRAPHER_COAST_SCENE.player.x,
      groundY(OCEANOGRAPHER_COAST_SCENE.player.x, OCEANOGRAPHER_COAST_SCENE.player.z),
      OCEANOGRAPHER_COAST_SCENE.player.z,
    );
    gameState.player.rotation.y = FACING_ANGLE.right;
    placeOceanographer(
      OCEANOGRAPHER_COAST_SCENE.oceanographer.x,
      OCEANOGRAPHER_COAST_SCENE.oceanographer.z,
      FACING_ANGLE.left,
    );
    syncLastPlayerY();
    showDialogSequence(
      [
        "[抵達預定的海洋設施區]",
        "[海洋學家走到岸邊，蹲下採取海水，舉起採樣瓶觀察]",
        hero("「？」"),
        marine("「有點混濁。」"),
        marine("「不是嚴重到一眼就能看出問題的程度。」"),
        marine("「但和我看過的舊紀錄不太一樣。」"),
        hero("「？」"),
        marine("「申請來這裡以前，我查過這座島留下來的環境資料。」"),
        marine("「以前這附近的海，應該比現在乾淨。」"),
        "[海洋學家收起採樣瓶]",
        marine("「所以我想先試一件事。」"),
        hero("「？」"),
        marine("「牡蠣。」"),
        hero("「？」"),
        marine("「……你是不是想到吃的了？」"),
        "[主角沉默]",
        marine("「別誤會。不只是為了吃。」"),
        marine("「牡蠣會攝食水中的浮游生物和懸浮有機物。」"),
        marine("「形成的結構，也能提供一些小型生物棲息。」"),
        hero("「！」"),
        marine("「不過別高興得太早。」"),
        marine("「放幾隻牡蠣下去，不會突然把海變乾淨。」"),
        marine("「水質、鹽度、底質、泥沙來源……任何一個條件不對，都可能養不活。」"),
        marine("「如果牠們能活下來，我們就多了一條線索。」"),
        "[海洋學家走到岸邊堆放的研究器材旁，掀開防水布]",
        hero("「？」"),
        marine("「這是我從本島帶來的。」"),
        marine("「原本就是為了這次調查準備的牡蠣架。」"),
        hero("「！」"),
        marine("「既然你也要在島上生活……這組就交給你吧。」"),
        systemDialog("獲得｜牡蠣架"),
        marine("「不過位置不能隨便選。跟我來。」"),
        marine("「這附近水深合適，也方便之後觀察。先放這裡。」"),
        "[主角協助海洋學家固定牡蠣架]",
      ],
      revealOysterRack,
    );
  });
}

function revealOysterRack() {
  unlockOysterFarming();
  void runBlackTransition("short", () =>
    new Promise<void>((resolve) => {
      loadMap("livingArea", OCEANOGRAPHER_COAST_SCENE.player, () => {
        syncLastPlayerY();
        gameState.player.rotation.y = FACING_ANGLE.right;
        placeOceanographer(
          OCEANOGRAPHER_COAST_SCENE.oceanographer.x,
          OCEANOGRAPHER_COAST_SCENE.oceanographer.z,
          FACING_ANGLE.left,
        );
        showDialogSequence(
          [
            marineCg("「很多人聽到海洋研究，會想到研究船、潛水器，或者很昂貴的儀器。」"),
            marineCg("「其實更多時候……只是每天回到同一個地方。」"),
            marineCg("「採樣、記錄、比較。然後等。」"),
            heroCg("「……」"),
            marineCg("「自然變化很慢。所以我們也得學會慢一點。」"),
            "[牡蠣架完成]",
            marine("「好了。」"),
            hero("「？」"),
            marine("「接下來……什麼都不做。」"),
            hero("「！？」"),
            marine("「觀察。」"),
            marine("「明天、後天、下星期，再回來看看。」"),
            marine("「如果牠們適應得好，我們才考慮增加數量。」"),
            marine("「養得活，和養得越多越好，是兩回事。」"),
            systemDialog("解鎖｜牡蠣養殖\n牡蠣需要時間成長，成熟後即可收穫。不同的海洋環境可能影響養殖結果。"),
            "[海洋學家收拾採樣器材]",
            marine("「本來只是想來跟你打聲招呼。」"),
            marine("「結果第一天就多了一個觀察站。」"),
            hero("「……」"),
            marine("「謝謝你。」"),
            marine("「差不多了。我接下來會沿著海岸再走一圈。」"),
            "[走出幾步，又回頭]",
            marine("「對了。」"),
            marine("「你平常應該比我更常在島上四處走吧？」"),
            hero("「？」"),
            marine("「如果在海邊看到不認識的生物，可以的話，拍張照片告訴我。」"),
            hero("「？」"),
            marine("「出現的位置、時間，如果記得的話也一起告訴我。」"),
            marine("「研究資料不一定要從研究室裡得到。」"),
            "[他看向海面]",
            marine("「一個人不可能同時看著整座島。」"),
            "[看回主角]",
            marine("「所以，多一雙眼睛很有幫助。」"),
            hero("「！」"),
            marine("「先謝了。」"),
            "[海洋學家離開，沿海岸開始調查]",
            systemDialog("海洋學家好感 +30\n個人事件完成"),
          ],
          completeOceanographerEvent,
        );
        resolve();
      });
    }),
  );
}

function completeOceanographerEvent() {
  addAffectionReward("marine_biologist", "personalEvent");
  oceanographerQuest.stage = "complete";
  oceanographerQuest.scenePos = null;
  setTimePauseSource("oceanographerEvent", false);
  lockEventClock(DAY_THREE_EVENT_DAY, OCEANOGRAPHER_EVENT_END_HOUR);
  gameState.cutsceneActive = false;
}