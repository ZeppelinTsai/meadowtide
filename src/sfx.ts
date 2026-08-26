// ==============================================================
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
  instance.volume = volume;
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
// 不是靠調高音量參數。這裡用的是專案素材夾裡原本就有、但還沒有任何
// 呼叫點用過的一顆鑼聲(freesound.org 素材，路徑保留原始檔名)——**這是
// 憑檔名猜的，我沒有實際聽過內容**，跟拋竿/收竿那兩組「找質感最接近
// 替代品」是同一種做法。如果聽起來不合適(太長、音色不對、跟拋竿音效
// 撞在一起很怪)，直接告訴我要換哪一顆，或提供新素材放進
// public/assets/audio/sfx/ 就能直接換掉這裡的路徑，呼叫端(game-loop.ts)
// 不用動。
export const FISH_BITE_SFX = [
  "466768__iut_paris8__machado_joanna_2018_2019_gongwav.wav",
];
