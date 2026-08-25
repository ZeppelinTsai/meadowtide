import { gameState } from "./game-state";

// 5.5) 背景音樂：季節日夜旋律層 + 天氣疊加層，全部經 GainNode 淡入淡出
// ==============================================================
export const BGM_BASE_PATH = "./assets/audio/bgm/";
export const BGM_TRACKS = {
  springDay: "StockTune-Playful Springtime Garden Dance_1787119801.mp3",
  springNight: "StockTune-Whispering Sakura Moonlight_1787119848.mp3",
  summerDay: "StockTune-Summer Breeze Echoes_1787119952.mp3",
  summerNight: "StockTune-Summer Evening Lake View_1787119973.mp3",
  autumnDay: "StockTune-Autumn Leaves Serenade_1787120062.mp3",
  autumnNight: "StockTune-Moonlit Autumn Serenade_1787120090.mp3",
  winterDay: "StockTune-Winter's Quiet Piano Whisper_1787120103.mp3",
  winterNight: "StockTune-Soft Blanket Of White_1787120137.mp3",
  rain: "StockTune-Raindrops On A Quiet Day_1787119556.mp3",
  typhoon: "StockTune-Tropical Storm Approaching_1787119620.mp3",
  snow: "StockTune-Icy Dawn Arising_1787119640.mp3",
  blizzard: "StockTune-Gliding Alpine White Peaks_1787119663.mp3",
  seaCaveAmbient: "StockTune-Moonlit Sirens Of Atlantis_1787682578.mp3",
  mountainCaveAmbient: "StockTune-Celestial Ice Cave Echoes_1787682579.mp3",
};
export const SEASON_MUSIC_KEYS = [
  ["springDay", "springNight"],
  ["summerDay", "summerNight"],
  ["autumnDay", "autumnNight"],
  ["winterDay", "winterNight"],
];
// 地域 BGM——依 gameState.currentMapName 查表，一張地圖配一首常駐曲。
// 完整優先序(高→低)：特殊事件 BGM > 通用事件 BGM > 地域 BGM > 天氣 BGM >
// 季節 BGM。目前只實作了「地域／天氣／季節」這三層——「特殊事件」跟
// 「通用事件」對應的遊戲系統(劇情節點、突發事件之類)還沒做，之後真的
// 要做時，這兩層的優先序要插在地域這層之上，屆時比照這裡的 desiredKey
// 判斷順序，在 updateMusic() 裡加在 locationKey 判斷之前即可，不用重
// 寫底下的淡入淡出/單軌切換機制。
// 鐘乳石洞窟(向下的海之洞)已經有地圖(stalactiteCave)，山之洞還沒開始
// 做地圖系統，先把曲目準備好(mountainCaveAmbient)，之後地圖 key 一旦
// 確定，在這裡補一行就會自動生效，不用動 updateMusic()。
export const LOCATION_MUSIC_KEYS: Record<string, string> = {
  stalactiteCave: "seaCaveAmbient",
  // 山之洞地圖系統做出來了(mountainCave)，補上原本就準備好的
  // mountainCaveAmbient——不用碰 updateMusic()，查表就自動生效。
  mountainCave: "mountainCaveAmbient",
};
export const MELODY_VOLUME = 0.32,
  WEATHER_VOLUME = 0.2;
export const BGM_LOOP_HEAD_SKIP = 0.08; // 跳過 MP3 開頭的編碼 padding
export const BGM_LOOP_TAIL_TRIM = 0.65; // 提前避開結尾留白／編碼 padding
let musicMasterGain: GainNode | null = null;
let musicReady = false;
let pendingMusicKey: string | null = null;
type MusicTrack = {
  audio: HTMLAudioElement;
  gain: GainNode;
  currentGain: number;
  playPending: boolean;
  failed: boolean;
};
export const musicTracks: Record<string, MusicTrack> = {};

export function createMusicTrack(key, filename) {
  const audio = new Audio(BGM_BASE_PATH + filename);
  audio.loop = true;
  audio.preload = "auto";
  const source = gameState.audioContext.createMediaElementSource(audio);
  const gain = gameState.audioContext.createGain();
  gain.gain.value = 0;
  source.connect(gain).connect(musicMasterGain);
  audio.addEventListener(
    "error",
    () => console.warn(`[BGM] 找不到或無法載入：${filename}`),
    { once: true },
  );
  // 每個 key 永遠只建立一個 Audio 實例；playPending 防止逐幀重複呼叫 play()。
  musicTracks[key] = {
    audio,
    gain,
    currentGain: 0,
    playPending: false,
    failed: false,
  };
}

export function ensureMusicTrackPlaying(track, key) {
  if (track.failed || track.playPending || !track.audio.paused) return;
  if (track.audio.currentTime === 0)
    track.audio.currentTime = BGM_LOOP_HEAD_SKIP;
  track.playPending = true;
  track.audio
    .play()
    .catch((error) => {
      track.failed = true;
      console.warn(`[BGM] 跳過無法播放的曲目：${BGM_TRACKS[key]}`, error);
    })
    .finally(() => {
      track.playPending = false;
    });
}

export function initializeMusic() {
  if (musicReady) {
    if (gameState.audioContext && gameState.audioContext.state === "suspended")
      gameState.audioContext.resume();
    return;
  }
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("[BGM] 此瀏覽器不支援 Web Audio API，背景音樂已停用。");
    return;
  }
  gameState.audioContext = new AudioContextClass();
  musicMasterGain = gameState.audioContext.createGain();
  musicMasterGain.gain.value = gameState.musicMuted ? 0 : 1;
  musicMasterGain.connect(gameState.audioContext.destination);
  Object.entries(BGM_TRACKS).forEach(([key, filename]) =>
    createMusicTrack(key, filename),
  );
  musicReady = true;
}

export function setMusicMuted(muted) {
  gameState.musicMuted = muted;
  initializeMusic();
  if (!musicMasterGain || !gameState.audioContext) return;
  const now = gameState.audioContext.currentTime;
  musicMasterGain.gain.cancelScheduledValues(now);
  musicMasterGain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.08);
}

export function updateMusic(nightFactor, dt) {
  if (!musicReady) return;
  const [dayKey, nightKey] = SEASON_MUSIC_KEYS[gameState.currentSeason];
  // 地域曲優先權最高(目前實作範圍內)：玩家在有配曲的地圖時
  // (LOCATION_MUSIC_KEYS 查得到)，不管外面天氣或季節是什麼，一律播該
  // 地圖自己的常駐曲；離開地圖後 locationKey 查不到，才交還給下面天氣/
  // 季節那套嚴格單軌邏輯。
  const locationKey = LOCATION_MUSIC_KEYS[gameState.currentMapName];
  // 嚴格單軌：壞天氣時由天氣曲取代旋律；晴天只選日曲或夜曲其中一首。
  const fairWeather =
    gameState.currentWeather === "clear" ||
    gameState.currentWeather === "cloudy";
  const desiredKey = locationKey
    ? locationKey
    : fairWeather
      ? nightFactor >= 0.5
        ? nightKey
        : dayKey
      : gameState.currentWeather === "storm"
        ? "typhoon"
        : gameState.currentWeather;
  if (desiredKey !== gameState.activeMusicKey) pendingMusicKey = desiredKey;
  if (!gameState.activeMusicKey) {
    gameState.activeMusicKey = pendingMusicKey;
    pendingMusicKey = null;
  }

  Object.entries(musicTracks).forEach(([key, track]) => {
    // 有待切換曲目時，舊曲必須先完整淡出；新曲要等舊曲 pause 後才啟動。
    // 地域曲跟季節曲同一個音量(MELODY_VOLUME)——洞窟常駐曲是氛圍旋律，
    // 不是「壞天氣」那種要蓋過去的強調層，沿用 WEATHER_VOLUME 反而會
    // 忽大忽小很奇怪。
    const isActive = key === gameState.activeMusicKey;
    const target =
      isActive && !pendingMusicKey
        ? locationKey
          ? MELODY_VOLUME
          : fairWeather
            ? MELODY_VOLUME
            : WEATHER_VOLUME
        : 0;
    if (target > 0.0005 || track.currentGain > 0.0005)
      ensureMusicTrackPlaying(track, key);
    // 不建立第二個音源做交疊；在單一實例抵達尾端留白前直接回到有效開頭。
    if (
      !track.audio.paused &&
      Number.isFinite(track.audio.duration) &&
      track.audio.duration > BGM_LOOP_HEAD_SKIP + BGM_LOOP_TAIL_TRIM &&
      track.audio.currentTime >= track.audio.duration - BGM_LOOP_TAIL_TRIM
    ) {
      track.audio.currentTime = BGM_LOOP_HEAD_SKIP;
    }
    const fadeSeconds = 0.65;
    const blend = 1 - Math.exp(-dt / fadeSeconds);
    track.currentGain += (target - track.currentGain) * blend;
    if (target === 0 && track.currentGain < 0.0005) {
      track.currentGain = 0;
      // 淡出完成才暫停；之後再次需要時從頭播放，避免 12 首全部靜音空轉。
      if (!track.audio.paused) {
        track.audio.pause();
        track.audio.currentTime = 0;
      }
    }
    track.gain.gain.value = track.currentGain;
  });

  if (pendingMusicKey && gameState.activeMusicKey) {
    const oldTrack = musicTracks[gameState.activeMusicKey];
    if (!oldTrack || oldTrack.currentGain === 0) {
      gameState.activeMusicKey = pendingMusicKey;
      pendingMusicKey = null;
    }
  }
}

// ==============================================================
addEventListener("pointerdown", initializeMusic, { once: true });
addEventListener(
  "keydown",
  (e) => {
    initializeMusic();
    if (e.key.toLowerCase() === "m" && !e.repeat)
      setMusicMuted(!gameState.musicMuted);
  },
  { capture: true },
);
