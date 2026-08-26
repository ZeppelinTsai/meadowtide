import { carpenterQuest, LAYOUT, NORTH_EXPANSION } from "./layout-maps";

// 3) NPC 行程表（跟 v11 相同，schedule 完全不需要知道怎麼走）
// ==============================================================
export function pos(x, z) {
  return { x, z };
}
// 船長站位錨點——往左(-1)、往上(-1)微調自 LAYOUT.port.basin.x/
// port.ferry.z，跟跳板/渡輪同一組座標系推導，之後那邊的 LAYOUT
// 數字再變，這裡不用跟著手動算。
const CAPTAIN_STAND_X = LAYOUT.port.basin.x - 1;
const CAPTAIN_STAND_Z = LAYOUT.port.ferry.z - 1;
export const npcDefs = [
  {
    id: "mayor",
    map: "oldVillage",
    name: "村長",
    shirt: 0xd9822b,
    hair: 0x241a12,
    home: {
      x: LAYOUT.oldVillage.plaza.x + 9,
      z: LAYOUT.oldVillage.plaza.z + 11,
    },
    schedule: [
      {
        t: 0.25,
        ...pos(LAYOUT.oldVillage.plaza.x + 9, LAYOUT.oldVillage.plaza.z + 11),
      },
      {
        t: 0.33,
        ...pos(LAYOUT.oldVillage.plaza.x + 5, LAYOUT.oldVillage.plaza.z + 8),
      },
      {
        t: 0.5,
        ...pos(LAYOUT.oldVillage.plaza.x + 10, LAYOUT.oldVillage.plaza.z + 14),
      },
      {
        t: 0.75,
        ...pos(LAYOUT.oldVillage.plaza.x + 6, LAYOUT.oldVillage.plaza.z + 17),
      },
      {
        t: 0.92,
        ...pos(LAYOUT.oldVillage.plaza.x + 9, LAYOUT.oldVillage.plaza.z + 11),
      },
    ],
  },
  {
    id: "carpenter",
    map: "livingArea",
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
  {
    // 船長——agent.txt：「上班地點:港口，居住地點:不住島上，已固定」，
    // 所以不像村長/木匠那樣有一整天的散步行程，只在跳板碼頭附近小範圍
    // 走動(檢查貨物/繩索的感覺)，站點都貼著 LAYOUT.port.ferry/basin
    // 算出來的跳板落地座標，不憑空手填數字。
    //
    // 2026-08-26：Zeppelin 反饋站位要往左一格、往上一格，加
    // CAPTAIN_STAND_X/Z 這兩個offset常數(basin.x-1、ferry.z-1)，
    // 底下 home/schedule 統一改用這兩個算好的錨點，不要各自散著加減。
    id: "captain",
    map: "port",
    name: "船長",
    shirt: 0x1f3a5f,
    hair: 0x3a3a3d,
    home: { x: CAPTAIN_STAND_X, z: CAPTAIN_STAND_Z },
    schedule: [
      { t: 0.25, ...pos(CAPTAIN_STAND_X, CAPTAIN_STAND_Z) },
      { t: 0.4, ...pos(CAPTAIN_STAND_X + 1, CAPTAIN_STAND_Z - 2) },
      { t: 0.55, ...pos(CAPTAIN_STAND_X, CAPTAIN_STAND_Z) },
      { t: 0.7, ...pos(CAPTAIN_STAND_X + 1, CAPTAIN_STAND_Z + 2) },
      { t: 0.9, ...pos(CAPTAIN_STAND_X, CAPTAIN_STAND_Z) },
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
  // 木匠抵達事件還沒觸發前，村長優先講這句引導台詞，帶玩家去港口。
  // 純粹是提示，不算進任務系統，事件一觸發（stage 離開 not_started）就恢復平常對話。
  if (npc.id === "mayor" && carpenterQuest.stage === "not_started") {
    return {
      text: "〔佔位台詞：今天有船會靠港，你要不要去碼頭看看？〕",
      speaker: "mayor",
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
