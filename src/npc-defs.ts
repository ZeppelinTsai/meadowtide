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
    // 廚師——2026-08-27：Zeppelin 先要外觀＋在廣場走動，明確說不用對話
    // /互動。開始動工才發現 src/chef-quest.ts 已經有一整套招募敘事邏輯
    // (dock 見面/看屋/共餐條件/入住)在同步開發中，而且
    // startChefMoveInScene() 裡已經寫死 `npcs.find(n => n.id === "chef")`
    // ——換句話說這個 npcDefs 項目本來就是那套邏輯需要、但還沒人補上的
    // 缺口，不是我另外發明的東西。
    // 這裡刻意還是讓她一直可見(走 npc-runtime.ts 通用分支
    // `mesh.visible = npc.map === mapName`，沒有像下面 handleChefDockTouch
    // 之類尚未接上的招募事件那樣，特意隱藏到 chefQuest.stage 進度到
    // moved_in 才現身)——這是照 Zeppelin「先放到場上看外觀」的要求做的
    // 暫時狀態，跟 chef-quest.ts 最終想要的敘事順序(玩家該先在碼頭事件
    // 見到她，不是提早在廣場撞見)不一致。之後誰把 CHEF_HOUSE/
    // CHEF_DOORSTEP 座標定案、把 handleChefDockTouch/
    // handleChefDoorstepTouch 接上 build-map.ts 的觸碰事件表時，記得比照
    // build-map.ts 木匠那段(npcs.forEach 那裡 `if (npc.id === "carpenter")`
    // 的特例分支，docs/decisions/npc-recruitment-pattern.md 有完整說明)
    // 幫 "chef" 也加一個特例：quest 還沒推進到 moved_in 之前 mesh.visible
    // 要是 false，現在這行為只是先讓 Zeppelin 看得到模型，不是最終設計。
    // 走動範圍刻意挑跟村長同一塊已驗證過能走的廣場區域、只是各點位往 x
    // 方向偏移 +3，兩人不會疊在同一個定點，也不用另外去試新的座標會不會
    // 卡住地形。
    id: "chef",
    map: "oldVillage",
    name: "廚師",
    shirt: 0xc1543a,
    hair: 0x3b2a1f,
    home: {
      x: LAYOUT.oldVillage.plaza.x + 12,
      z: LAYOUT.oldVillage.plaza.z + 11,
    },
    schedule: [
      {
        t: 0.2,
        ...pos(LAYOUT.oldVillage.plaza.x + 12, LAYOUT.oldVillage.plaza.z + 11),
      },
      {
        t: 0.4,
        ...pos(LAYOUT.oldVillage.plaza.x + 8, LAYOUT.oldVillage.plaza.z + 8),
      },
      {
        t: 0.55,
        ...pos(LAYOUT.oldVillage.plaza.x + 13, LAYOUT.oldVillage.plaza.z + 14),
      },
      {
        t: 0.8,
        ...pos(LAYOUT.oldVillage.plaza.x + 9, LAYOUT.oldVillage.plaza.z + 17),
      },
      {
        t: 0.95,
        ...pos(LAYOUT.oldVillage.plaza.x + 12, LAYOUT.oldVillage.plaza.z + 11),
      },
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
