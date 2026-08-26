import { carpenterQuest, LAYOUT, NORTH_EXPANSION } from "./layout-maps";

// 3) NPC 行程表（跟 v11 相同，schedule 完全不需要知道怎麼走）
// ==============================================================
export function pos(x, z) {
  return { x, z };
}
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
    id: "captain",
    map: "port",
    name: "船長",
    shirt: 0x1f3a5f,
    hair: 0x3a3a3d,
    home: { x: LAYOUT.port.basin.x, z: LAYOUT.port.ferry.z },
    schedule: [
      { t: 0.25, ...pos(LAYOUT.port.basin.x, LAYOUT.port.ferry.z) },
      { t: 0.4, ...pos(LAYOUT.port.basin.x + 1, LAYOUT.port.ferry.z - 2) },
      { t: 0.55, ...pos(LAYOUT.port.basin.x, LAYOUT.port.ferry.z) },
      { t: 0.7, ...pos(LAYOUT.port.basin.x + 1, LAYOUT.port.ferry.z + 2) },
      { t: 0.9, ...pos(LAYOUT.port.basin.x, LAYOUT.port.ferry.z) },
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
