import { carpenterQuest, NORTH_EXPANSION } from "./layout-maps";

// 3) NPC 行程表（跟 v11 相同，schedule 完全不需要知道怎麼走）
      // ==============================================================
      export function pos(x, z) {
        return { x, z };
      }
      export const npcDefs = [
        {
          id: "aunt",
          name: "阿姨",
          shirt: 0xd9822b,
          hair: 0x241a12,
          home: { x: 21, z: 12 + NORTH_EXPANSION },
          schedule: [
            { t: 0.25, ...pos(21, 12 + NORTH_EXPANSION) },
            { t: 0.33, ...pos(18, 13 + NORTH_EXPANSION) },
            { t: 0.5, ...pos(24, 13 + NORTH_EXPANSION) },
            { t: 0.75, ...pos(23, 15 + NORTH_EXPANSION) },
            { t: 0.92, ...pos(21, 12 + NORTH_EXPANSION) },
          ],
        },
        {
          id: "carpenter",
          name: "木匠",
          shirt: 0x6b5b4a,
          hair: 0x1a1a1a,
          home: { x: 25, z: 16 + NORTH_EXPANSION },
          schedule: [
            { t: 0.29, ...pos(25, 16 + NORTH_EXPANSION) },
            { t: 0.35, ...pos(23, 15 + NORTH_EXPANSION) },
            { t: 0.5, ...pos(24, 13 + NORTH_EXPANSION) },
            { t: 0.55, ...pos(23, 15 + NORTH_EXPANSION) },
            { t: 0.75, ...pos(21, 12 + NORTH_EXPANSION) },
            { t: 0.92, ...pos(25, 16 + NORTH_EXPANSION) },
          ],
        },
      ];
      export function getScheduleTarget(schedule, phase) {
        let target = schedule[schedule.length - 1];
        for (const entry of schedule) {
          if (entry.t <= phase) target = entry;
          else break;
        }
        return target;
      }
      export function npcLine(npc) {
        // 回傳 {text, speaker, name} 給對話框的立繪/名牌系統用；speaker 對應
        // src/assets/portraits/<speaker>.png，還沒有圖檔時立繪版位就是空的。
        // 木匠抵達事件還沒觸發前，阿姨（=村長）優先講這句引導台詞，帶玩家去港口。
        // 純粹是提示，不算進任務系統，事件一觸發（stage 離開 not_started）就恢復平常對話。
        if (npc.id === "aunt" && carpenterQuest.stage === "not_started") {
          return {
            text: "〔佔位台詞：今天有船會靠港，你要不要去碼頭看看？〕",
            speaker: "aunt",
            name: "村長",
          };
        }
        if (npc.memory <= 0)
          return { text: "「哈囉，天氣不錯。」", speaker: npc.id, name: npc.name };
        if (npc.memory < 3)
          return {
            text: "「我有看到你在種東西喔，加油。」",
            speaker: npc.id,
            name: npc.name,
          };
        return {
          text: "「這片田都是你顧出來的呢，種得不錯。」",
          speaker: npc.id,
          name: npc.name,
        };
      }
