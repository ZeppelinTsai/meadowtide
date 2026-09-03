// ==============================================================
import { gameSettings, getMasterOutput } from "./settings";

// 一次性音效——跟 music.ts 的 BGM 系統不一樣：BGM 是常駐 loop、經
// AudioContext 的 GainNode 做淡入淡出；這裡單純「觸發當下播一次就丟
// 掉」，用原生 <audio> 就好，不用接進 BGM 那張 GainNode 圖。
//
// 每個音效路徑對應一個「範本」HTMLAudioElement(快取、只建立一次)，
// 實際播放時 cloneNode() 出一個新的一次性副本再 play()——這樣連續觸發
// (例如連砍兩下、礦點很密集連採)可以疊播，不會被前一個播放中的音效
// 打斷或卡住。缺檔案的處理方式跟 BGM 一樣：只在 console 警告、不中斷
// 遊戲，音檔之後陸續補進資料夾就會自動生效，不用改程式碼。
// ==============================================================
export const SFX_BASE_PATH = "./assets/audio/sfx/";
// 玩家反饋原本 0.55 太小聲，先拉到 100%(1.0，約是原本的兩倍)當新的
// 預設值；之後主選單做音量設定選項時，這裡改成讀玩家調整過的值即可，
// 呼叫端(input-save.ts 四個播放點)不用跟著動。
export const SFX_VOLUME = 1.0;

const sfxTemplates: Record<string, HTMLAudioElement> = {};

function loadSfxTemplate(path: string): HTMLAudioElement {
  let template = sfxTemplates[path];
  if (!template) {
    template = new Audio(SFX_BASE_PATH + path);
    template.preload = "auto";
    template.addEventListener(
      "error",
      () => console.warn(`[SFX] 找不到或無法載入：${path}`),
      { once: true },
    );
    sfxTemplates[path] = template;
  }
  return template;
}

export function playSfx(path: string, volume = SFX_VOLUME) {
  const template = loadSfxTemplate(path);
  const instance = template.cloneNode(true) as HTMLAudioElement;
  instance.volume = Math.max(0, Math.min(1, volume * getMasterOutput() * gameSettings.sfxVolume));
  // 使用者互動前瀏覽器可能擋自動播放；這裡的呼叫點都掛在 E 鍵/採集這類
  // 使用者手勢底下，理論上不會被擋，但 play() 回傳的 Promise 失敗時安靜
  // 吞掉，不要讓音效問題打斷遊戲邏輯。
  instance.play().catch(() => {});
}

// 同一個動作常備好幾個變化版本(kenney 音效包大多一組 5 個 _000~_004)，
// 每次隨機挑一個播，聽起來才不會太機械式重複。
export function playRandomSfx(paths: string[], volume = SFX_VOLUME) {
  if (!paths.length) return;
  playSfx(paths[Math.floor(Math.random() * paths.length)], volume);
}

// ==============================================================
// 各動作對應的音效清單——集中在這裡維護，之後要換音檔/加變化版本只改
// 這裡，不用去每個呼叫點找。全部來自 public/assets/audio/sfx 底下的
// CC0 素材(kenney 音效包)。
// ==============================================================
export const CHOP_WOOD_SFX = [
  "kenney_impact-sounds/Audio/impactWood_medium_000.ogg",
  "kenney_impact-sounds/Audio/impactWood_medium_001.ogg",
  "kenney_impact-sounds/Audio/impactWood_medium_002.ogg",
  "kenney_impact-sounds/Audio/impactWood_medium_003.ogg",
  "kenney_impact-sounds/Audio/impactWood_medium_004.ogg",
];
export const MINE_ORE_SFX = [
  "kenney_impact-sounds/Audio/impactMining_000.ogg",
  "kenney_impact-sounds/Audio/impactMining_001.ogg",
  "kenney_impact-sounds/Audio/impactMining_002.ogg",
  "kenney_impact-sounds/Audio/impactMining_003.ogg",
  "kenney_impact-sounds/Audio/impactMining_004.ogg",
];
// 音效包裡沒有現成的「拋竿/收竿」素材，這兩組是找質感最接近的替代：
// 拋竿用「丟骰子」的甩動+落地聲代表甩竿出去；收竿用「皮帶扣具」的
// 拉緊聲代表拉線回收。之後如果補到專門的甩竿/捲線音效，直接換掉這兩個
// 陣列的路徑即可，呼叫端(input-save.ts)不用動。
export const FISH_CAST_SFX = [
  "kenney_casino-audio/Audio/dice-throw-1.ogg",
  "kenney_casino-audio/Audio/dice-throw-2.ogg",
  "kenney_casino-audio/Audio/dice-throw-3.ogg",
];
export const FISH_REEL_SFX = [
  "kenney_rpg-audio/Audio/beltHandle1.ogg",
  "kenney_rpg-audio/Audio/beltHandle2.ogg",
];
// 上鉤(casting→biting)那一刻的提示音——Zeppelin 明確要求「大震動大
// 音效」，因為咬鉤窗只有 1.1 秒，反應時間很短，需要一個一聽就懂「現在
// 立刻按 E」的強烈提示，跟拋竿/收竿那種背景質感的音效不是同一個等級。
// SFX_VOLUME 已經是 1.0(全音量，見上面的說明)，音量已經拉滿沒有再往上
// 的空間，所以「更大聲」是靠換一顆本身聽起來更巨大/更突兀的音效達成，
// 不是靠調高音量參數。
// 2026-08-27：原本這裡用的是猜檔名選的一顆鑼聲(freesound.org 素材)，
// 沒人實際聽過內容——Zeppelin 換成 kenney_interface-sounds 素材包裡的
// drop_004.ogg，路徑跟其他 SFX 常數同一套「相對 SFX_BASE_PATH」寫法。
export const FISH_BITE_SFX = [
  "kenney_interface-sounds/Audio/drop_004.ogg",
];
export const RELATIONSHIP_EVENT_SFX =
  "kenney_interface-sounds/Audio/confirmation_004.ogg";

// ==============================================================
// 2026-09-03 Zeppelin 要求開始「盤點各方面操作、補音效」，先從這兩塊
// 開始：漫畫演出(comic-cue.ts 的 ?!｜|||…等分格符號)跟蜂蜜收成。
// 這裡先只配檔名(現有的 kenney_interface-sounds 素材裡最貼近語意的
// 命名)，都還沒實際聽過內容——播放失敗只會在 console 警告、不影響遊戲
// (見檔案開頭說明)，之後聽過覺得不搭再直接換路徑即可。
// ==============================================================

// 漫畫演出音效——對應 comic-cue-logic.ts 的 ComicCueKind，每種反應各挑
// 一組風格接近的變化版本，showComicCue() 觸發時依 kind 對應播放。
export const COMIC_CUE_SFX: Record<
  "!" | "?" | "..." | "panicDrops" | "sweatFace" | "gloom",
  string[]
> = {
  // 驚訝／發現——短促上揚的撥弦聲＋一聲鐘鳴，模擬「叮！」的恍然大悟感。
  "!": [
    "kenney_interface-sounds/Audio/pluck_001.ogg",
    "kenney_interface-sounds/Audio/pluck_002.ogg",
    "kenney_interface-sounds/Audio/bong_001.ogg",
  ],
  // 疑惑——素材包裡就有直接命名為 question 的一組，語意最直接。
  "?": [
    "kenney_interface-sounds/Audio/question_001.ogg",
    "kenney_interface-sounds/Audio/question_002.ogg",
    "kenney_interface-sounds/Audio/question_003.ogg",
    "kenney_interface-sounds/Audio/question_004.ogg",
  ],
  // 語塞／欲言又止——只用很輕的一聲滴答標記停頓，不做太搶戲的音效。
  "...": [
    "kenney_interface-sounds/Audio/tick_001.ogg",
    "kenney_interface-sounds/Audio/tick_002.ogg",
    "kenney_interface-sounds/Audio/tick_004.ogg",
  ],
  // 慌張冒冷汗滴——error 那組音色比較躁、有點手忙腳亂的感覺，貼近
  // 「哇哇哇」的驚慌感，跟下面單純一滴汗(sweatFace)的沉穩感做區隔。
  panicDrops: [
    "kenney_interface-sounds/Audio/error_001.ogg",
    "kenney_interface-sounds/Audio/error_002.ogg",
    "kenney_interface-sounds/Audio/error_003.ogg",
    "kenney_interface-sounds/Audio/error_004.ogg",
  ],
  // 單顆尷尬汗滴——直接借「drop」語意，跟畫面上那滴水滴呼應。
  sweatFace: [
    "kenney_interface-sounds/Audio/drop_001.ogg",
    "kenney_interface-sounds/Audio/drop_002.ogg",
    "kenney_interface-sounds/Audio/drop_003.ogg",
  ],
  // 陰鬱／「|||」——借用「縮小視窗」的音色，呼應角色情緒往下縮的感覺，
  // 音效包裡沒有真的「洩氣長音」可以用，先這樣佔位。
  gloom: [
    "kenney_interface-sounds/Audio/minimize_001.ogg",
    "kenney_interface-sounds/Audio/minimize_002.ogg",
    "kenney_interface-sounds/Audio/minimize_003.ogg",
  ],
};

// 蜂蜜收成——採到蜂蜜那一刻的提示音，借「glass」那組(掀開蜂箱蓋/裝進
// 玻璃罐的清脆感)。跟牡蠣架同一種「單點資源，按 E 採收」的互動，牡蠣架
// 目前也還沒配音效，先只做蜂蜜這個是照 Zeppelin 這次明確點名的範圍。
export const HONEY_HARVEST_SFX = [
  "kenney_interface-sounds/Audio/glass_001.ogg",
  "kenney_interface-sounds/Audio/glass_002.ogg",
  "kenney_interface-sounds/Audio/glass_003.ogg",
];
