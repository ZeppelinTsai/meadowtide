import { gameState, inventory, isNightTime } from "./game-state";
import {
  carpenterQuest,
  CARPENTER_MATERIALS,
} from "./layout-maps";
import {
  showDialog,
  showDialogSequence,
  dialogQueue,
} from "./dialogue";
import { npcGroup, npcs } from "./npc-runtime";

export function carpenterHasMaterials() {
        return (
          inventory.wood >= CARPENTER_MATERIALS.wood &&
          inventory.stone >= CARPENTER_MATERIALS.stone
        );
      }
      export function startCarpenterDockScene() {
        carpenterQuest.stage = "escorting";
        const fade = document.getElementById("fade") as HTMLElement;
        fade.style.opacity = "1";
        setTimeout(() => {
          const aunt = npcs.find((n) => n.id === "aunt");
          const carpenter = npcs.find((n) => n.id === "carpenter");
          npcGroup.visible = true;
          // 兩人一開始就疊在主角腳下（不是左右錯開的固定偏移），高度也直接
          // 抄主角當下算好的世界座標 Y。escort 的「跟走」邏輯（game-loop.ts
          // 的 sampleCarpenterEscortTrail）只認主角走過的軌跡點，起點偏到
          // 側邊/用假高度會讓兩人一開始就落在軌跡以外，直到主角走出足夠
          // 距離把這個假起點推出取樣窗口前，都會穿到台子/樓梯下面。
          if (aunt) {
            aunt.mesh.visible = true;
            aunt.mesh.position.set(
              gameState.player.position.x,
              gameState.player.position.y,
              gameState.player.position.z,
            );
          }
          if (carpenter) {
            carpenter.mesh.visible = true;
            carpenter.mesh.position.set(
              gameState.player.position.x,
              gameState.player.position.y,
              gameState.player.position.z,
            );
          }
          fade.style.opacity = "0";
          showDialogSequence([
          {
            text: "「船差不多要到了。這位是……木工出身，說是想找個能重新蓋東西的地方。」",
            speaker: "aunt",
            name: "村長",
          },
          "[船靠岸，一個背著工具包的年輕人跳下船，還沒站穩就先低頭看了看腳下的木棧板]",
          { text: "「這塊板已經鬆了。」", speaker: "carpenter" },
          { text: "「呃——歡迎來到島上？」", speaker: "aunt", name: "村長" },
          {
            text: "「（蹲下，用手指按了按木板）嗯，歡迎。這個要是不修，再一個月就會有人踩空摔進海裡。」",
            speaker: "carpenter",
          },
          {
            text: "「（苦笑）他就是這樣。走吧，先帶他去看看能住的地方。」",
            speaker: "aunt",
            name: "村長",
          },
          ]);
        }, 400);
      }
      export function handleCarpenterDockTouch() {
        if (dialogQueue.length) return; // 對話播放中不要被重新觸發打斷
        if (carpenterQuest.stage === "not_started") startCarpenterDockScene();
      }
      export function tryStartCarpenterConstruction() {
        if (!carpenterHasMaterials()) {
          carpenterQuest.stage = "escorting";
          showDialog({
            text: "「這樣還不夠，等你準備齊了再來找我。」",
            speaker: "carpenter",
          });
          return;
        }
        inventory.wood -= CARPENTER_MATERIALS.wood;
        inventory.stone -= CARPENTER_MATERIALS.stone;
        carpenterQuest.stage = "construction";
        carpenterQuest.constructionStartDay = gameState.currentDay;
        const carpenterNpc = npcs.find((n) => n.id === "carpenter");
        if (carpenterNpc) carpenterNpc.mesh.visible = false;
        npcGroup.visible = false;
        showDialogSequence([
          {
            text: "「夠了。剩下的我自己來——不是不信任你，是這種事我習慣自己看著。」",
            speaker: "carpenter",
          },
          {
            text: "「你要是哪天閒著沒事，可以來看看。我大概不會跟你聊天，但可以讓你看我怎麼修。」",
            speaker: "carpenter",
          },
        ]);
      }
      export function startCarpenterVillageScene() {
        carpenterQuest.stage = "village_scene_done"; // 立刻推進，避免對話播放中重複觸發
        showDialogSequence(
          [
            "[木匠一路經過每一戶空屋都會放慢腳步看兩眼]",
            {
              text: "「（自言自語）這間的地基還行……這間屋頂大概撐不過下一次颱風。」",
              speaker: "carpenter",
            },
            "[抵達指定的空屋，他站在門口看了很久，沒有立刻進去]",
            "玩家：「這間怎麼樣？」",
            { text: "「……可以。」", speaker: "carpenter" },
            {
              text: "「我蓋過不少房子。別人的。這是第一次要蓋一間，是我自己要住的。」",
              speaker: "carpenter",
            },
            { text: "「有點奇怪。」", speaker: "carpenter" },
            {
              text: "「材料的話——木材跟石材，能給我多少？」",
              speaker: "carpenter",
            },
          ],
          tryStartCarpenterConstruction,
        );
      }
      export function startCarpenterMoveInScene() {
        carpenterQuest.stage = "moved_in";
        showDialogSequence([
          "[窗戶第一次亮起燈，木匠站在自己家門口，看著屋裡的光]",
          {
            // 這是刻意選定的「關鍵劇情節點」CG 掛點：入住當晚的收尾這一句份量
            // 夠重，值得全螢幕 CG。圖檔還沒生成，src/assets/cg/ 沒有對應檔案
            // 時 setDialogCg() 會 warn 一聲然後留在原本的 3D 畫面，不會卡住。
            text: "「這是我這輩子第一次，晚上回家的時候，知道裡面沒有別人在等我驗收。」",
            speaker: "carpenter",
            cg: "carpenter_movein",
          },
        ]);
        const carpenterNpc = npcs.find((n) => n.id === "carpenter");
        if (carpenterNpc) carpenterNpc.mesh.visible = true;
      }
      export function handleCarpenterDoorstepTouch() {
        if (dialogQueue.length) return;
        if (carpenterQuest.stage === "escorting") {
          startCarpenterVillageScene();
        } else if (
          carpenterQuest.stage === "ready_for_move_in" &&
          isNightTime()
        ) {
          startCarpenterMoveInScene();
        }
      }
