import { UI_TRANSLATIONS } from "./ui-translations";

// i18n.ts — 共用語言入口。新文本使用 t("key")；既有中文 UI／對話在
// 完成穩定 key 遷移前先走 translateText(source) 與 ui-translations.ts。
//
// 使用方式（瀏覽器 devtools console，遊戲跑起來之後就能打）：
//   meadowtideI18n.setLocale("en")   // 切到英文
//   meadowtideI18n.setLocale("ja")   // 切到日文
//   meadowtideI18n.setLocale("zh")   // 切回中文（預設）
//   meadowtideI18n.getLocale()       // 查目前語言
//   meadowtideI18n.locales           // 列出支援的語言代碼
//
// 已知限制（現階段刻意簡化，不是 bug）：
// - 語言只在「下一次觸發新對話」時生效，已經顯示在畫面上的對話框不會
//   即時重繪成新語言——因為 dialogue.ts 的 showDialogSequence() 是把整段
//   對話陣列在觸發當下算好存進 dialogQueue，t() 只在那個當下被呼叫一次。
// - 語言偏好由 settings.ts 保存，與音量／解析度同屬裝置設定，不綁單一存檔。
// - 沒有處理立繪/CG 檔名依語言切換——目前所有語言共用同一套
//   public/assets/portraits、public/assets/cg，不用另外準備多語言素材。

export type Locale = "zh" | "en" | "ja";
export const SUPPORTED_LOCALES: Locale[] = ["zh", "en", "ja"];
export const DEFAULT_LOCALE: Locale = "zh";

let currentLocale: Locale = DEFAULT_LOCALE;
const localeListeners = new Set<(locale: Locale) => void>();
const originalText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const warnedMissingSources = new Set<string>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: string): boolean {
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    console.warn(
      `[i18n] 不支援的語言代碼 "${locale}"，可用：${SUPPORTED_LOCALES.join(", ")}`,
    );
    return false;
  }
  currentLocale = locale as Locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = currentLocale === "zh" ? "zh-Hant" : currentLocale;
  }
  localeListeners.forEach((listener) => listener(currentLocale));
  console.log(
    `[i18n] 語言已切換為 "${currentLocale}"（下一次觸發的對話會套用新語言）`,
  );
  return true;
}

export function onLocaleChanged(listener: (locale: Locale) => void) {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

type TranslationTree = { [key: string]: string | TranslationTree };

function resolve(tree: TranslationTree, path: string[]): string | undefined {
  let node: string | TranslationTree | undefined = tree;
  for (const part of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * 依目前語言查翻譯字串；key 用點分隔對應巢狀結構，例如
 * "carpenter.dock.mayorIntro"。查不到目前語言的翻譯會退回 DEFAULT_LOCALE
 * （中文），兩邊都查不到就直接回傳 key 本身並在 console 警告——這樣缺翻譯
 * 時畫面上會出現看得懂是哪一句缺的 key，不會整個對話框空白或噴例外。
 */
export function t(key: string): string {
  const path = key.split(".");
  const direct = resolve(TRANSLATIONS[currentLocale], path);
  if (direct !== undefined) return direct;
  const fallback = resolve(TRANSLATIONS[DEFAULT_LOCALE], path);
  if (fallback !== undefined) {
    console.warn(`[i18n] "${key}" 缺少 "${currentLocale}" 翻譯，改用預設語言。`);
    return fallback;
  }
  console.warn(`[i18n] 找不到翻譯鍵 "${key}"`);
  return key;
}

/** Translate legacy source text while it is being migrated to stable t() keys. */
export function translateText(source: string): string {
  if (currentLocale === "zh") return source;
  const translated =
    UI_TRANSLATIONS[currentLocale][source] ?? NAME_LOOKUP[currentLocale][source];
  if (translated !== undefined) return translated;
  if (import.meta.env.DEV && /[一-龥]/.test(source) && !warnedMissingSources.has(source)) {
    warnedMissingSources.add(source);
    console.warn(`[i18n] 尚缺 ${currentLocale} 原文翻譯：${source}`);
  }
  return source;
}

/** Translate static HTML text and accessibility attributes, preserving the zh source. */
export function translateDocument(root: ParentNode = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = null;
  while ((node = walker.nextNode())) {
    if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName || "")) continue;
    if (!originalText.has(node)) originalText.set(node, node.textContent || "");
    const source = originalText.get(node) || "";
    const match = source.match(/^(\s*)(.*?)(\s*)$/s);
    if (match && match[2]) node.textContent = match[1] + translateText(match[2]) + match[3];
  }
  root.querySelectorAll?.("[aria-label], [title], [alt]").forEach((element) => {
    const saved = originalAttributes.get(element) || new Map<string, string>();
    for (const attr of ["aria-label", "title", "alt"]) {
      if (element.hasAttribute(attr) && !saved.has(attr)) {
        saved.set(attr, element.getAttribute(attr) || "");
      }
      if (saved.has(attr)) element.setAttribute(attr, translateText(saved.get(attr)!));
    }
    originalAttributes.set(element, saved);
  });
}

// ==============================================================
// 翻譯內容——目前只有 carpenter.* 這一組（對應 src/carpenter-quest.ts
// 的四段對話 + 材料不足提示 + 名牌），是第一個試點，用來驗證整套
// key/查表/console 切換語言的機制堪用。其他事件（例如之後的 chef.*）要
// 上多語言時，比照這個結構在下面新增一個頂層 key 就好。
// ==============================================================
const TRANSLATIONS: Record<Locale, TranslationTree> = {
  zh: {
    // characters/places——2026-09-03 新增的共用命名空間。之前只有
    // carpenter.name.{mayor,carpenter} 這兩個名字有三語翻譯，鎖在
    // carpenter.* 底下；其他事件想顯示村長的名字，要嘛重複存一次翻譯，
    // 要嘛借用一個語意不合的 key（carpenter.name.mayor 用在跟木匠無關
    // 的事件上很奇怪）。這裡把「角色/地點顯示名」獨立成共用命名空間，
    // 任何 StoryEvent 的 dialogue step 都可以直接
    // nameKey: "characters.mayor"，不用管這句話原本屬於哪個章節。
    // carpenter.name.* 保留不動（避免動到已經在正式運作的木匠事件），
    // 但兩邊內容刻意保持一致，之後木匠事件要遷移時可以直接改用這裡。
    characters: {
      mayor: "村長",
      carpenter: "木匠",
      chef: "廚師",
      captain: "船長",
      artist: "藝術家",
    },
    // 跟 src/ui-translations.ts 裡地圖圖例既有的 山區/城鎮/牧場/港口
    // 完全同一組字串——這裡是新開的結構化來源，兩邊字串一致才能讓
    // translateText() 底下的 NAME_LOOKUP 推導對上（見檔案下方）。
    places: {
      livingArea: "牧場",
      port: "港口",
      oldVillage: "城鎮",
      mountain: "山區",
    },
    carpenter: {
      name: { mayor: "村長", carpenter: "木匠" },
      dock: {
        mayorIntro:
          "「船差不多要到了。這位是……木工出身，說是想找個能重新蓋東西的地方。」",
        narrationArrive:
          "[船靠岸，一個背著工具包的年輕人跳下船，還沒站穩就先低頭看了看腳下的木棧板]",
        carpenterPlank: "「這塊板已經鬆了。」",
        mayorWelcome: "「呃——歡迎來到島上？」",
        carpenterKneel:
          "「（蹲下，用手指按了按木板）嗯，歡迎。這個要是不修，再一個月就會有人踩空摔進海裡。」",
        mayorLaugh: "「（苦笑）他就是這樣。走吧，先帶他去看看能住的地方。」",
      },
      materialsNotEnough: "「這樣還不夠，等你準備齊了再來找我。」",
      construction: {
        start1:
          "「夠了。剩下的我自己來——不是不信任你，是這種事我習慣自己看著。」",
        start2:
          "「你要是哪天閒著沒事，可以來看看。我大概不會跟你聊天，但可以讓你看我怎麼修。」",
      },
      village: {
        narrationWalk: "[木匠一路經過每一戶空屋都會放慢腳步看兩眼]",
        mutter:
          "「（自言自語）這間的地基還行……這間屋頂大概撐不過下一次颱風。」",
        narrationDoor: "[抵達指定的空屋，他站在門口看了很久，沒有立刻進去]",
        playerAsk: "玩家：「這間怎麼樣？」",
        ok: "「……可以。」",
        builtMany:
          "「我蓋過不少房子。別人的。這是第一次要蓋一間，是我自己要住的。」",
        odd: "「有點奇怪。」",
        materialsAsk: "「材料的話——木材跟石材，能給我多少？」",
      },
      moveIn: {
        narrationLight: "[窗戶第一次亮起燈，木匠站在自己家門口，看著屋裡的光]",
        final:
          "「這是我這輩子第一次，晚上回家的時候，知道裡面沒有別人在等我驗收。」",
      },
    },
    // devTest.* — 2026-09-01 event-system Phase 1 概念驗證專用，見
    // src/story/chapters/dev-phase1-probe.ts 跟 docs/decisions/event-system.md。
    // 只有 F9 debug 熱鍵會觸發，不是正式章節內容，之後 Phase 1 驗證完可以整組刪掉。
    devtest: {
      wave: {
        narration_approach: "[村長被叫住，腳步停了一下，轉身走過來]",
        greeting: "「怎麼，找我有事？」",
        follow_up: "「（笑）好，我知道了，先這樣，我還要去巡一下田。」",
      },
    },
  },
  en: {
    characters: {
      mayor: "Mayor",
      carpenter: "Carpenter",
      chef: "Chef",
      captain: "Captain",
      artist: "Artist",
    },
    places: {
      livingArea: "Farm",
      port: "Port",
      oldVillage: "Town",
      mountain: "Mountain",
    },
    carpenter: {
      name: { mayor: "Mayor", carpenter: "Carpenter" },
      dock: {
        mayorIntro:
          '"The ferry should be here soon. This is... a carpenter by trade — he says he\'s looking for a place where he can rebuild things."',
        narrationArrive:
          "[The boat docks. A young man with a tool bag slung over his shoulder jumps off, and before he's even steadied himself, he's already looking down at the boards under his feet.]",
        carpenterPlank: '"This board\'s come loose."',
        mayorWelcome: '"Uh — welcome to the island?"',
        carpenterKneel:
          '"(Crouches down, presses a finger against the plank) Mm. Welcome. If this isn\'t fixed, someone\'s going to step through it and fall into the sea within a month."',
        mayorLaugh:
          '"(Wry smile) That\'s just how he is. Come on, let\'s show him somewhere he could live."',
      },
      materialsNotEnough:
        '"That\'s not enough yet. Come find me again once you\'ve got the rest."',
      construction: {
        start1:
          '"That\'s enough. I\'ll take it from here myself — it\'s not that I don\'t trust you, I just prefer to watch this kind of thing with my own eyes."',
        start2:
          '"If you\'re ever free with nothing to do, feel free to stop by. I probably won\'t talk much, but you can watch how I work."',
      },
      village: {
        narrationWalk:
          "[The carpenter slows down in front of every empty house along the way, giving each one a long look.]",
        mutter:
          '"(Mutters to himself) This one\'s foundation is decent... that roof over there probably won\'t survive the next typhoon."',
        narrationDoor:
          "[He arrives at the designated empty house and stands at the door for a long while without going in.]",
        playerAsk: 'You: "What do you think of this one?"',
        ok: '"...It\'ll do."',
        builtMany:
          '"I\'ve built plenty of houses. For other people. This is the first time I\'m building one for myself to live in."',
        odd: '"Feels strange."',
        materialsAsk:
          '"About the materials — wood and stone, how much can you spare?"',
      },
      moveIn: {
        narrationLight:
          "[The window lights up for the first time. The carpenter stands at his own front door, looking at the light spilling out from inside.]",
        final:
          '"This is the first time in my life that, coming home at night, I know there\'s no one inside waiting to inspect my work."',
      },
    },
    devtest: {
      wave: {
        narration_approach: "[The mayor, called over, pauses mid-step and turns to walk over.]",
        greeting: '"What is it, need something?"',
        follow_up: '"(Smiles) Alright, got it. I should get back to checking the fields."',
      },
    },
  },
  ja: {
    characters: {
      mayor: "村長",
      carpenter: "大工",
      chef: "シェフ",
      captain: "船長",
      artist: "アーティスト",
    },
    places: {
      livingArea: "牧場",
      port: "港",
      oldVillage: "町",
      mountain: "山地",
    },
    carpenter: {
      name: { mayor: "村長", carpenter: "大工" },
      dock: {
        mayorIntro:
          "「そろそろ船が着く頃だ。この人は……大工の出で、何か建て直せる場所を探しているらしい。」",
        narrationArrive:
          "[船が着岸し、道具袋を背負った若者が飛び降りる。体勢を整える前に、まず足元の桟橋の板を見下ろした]",
        carpenterPlank: "「この板、緩んでるな。」",
        mayorWelcome: "「え——島へようこそ、かな？」",
        carpenterKneel:
          "「（しゃがんで指で板を押してみる）ふむ、ようこそ。これを直さなきゃ、来月には誰か踏み抜いて海に落ちるぞ。」",
        mayorLaugh: "「（苦笑い）彼はいつもこうなんだ。行こう、まずは住める場所を案内しよう。」",
      },
      materialsNotEnough: "「これじゃまだ足りない。揃ったらまた来てくれ。」",
      construction: {
        start1:
          "「もう十分だ。あとは自分でやる——信用してないわけじゃない、こういうことは自分の目で見ながらやる質でね。」",
        start2:
          "「暇な時にでも見に来るといい。あまり喋らないと思うが、どう直すか見せてやれる。」",
      },
      village: {
        narrationWalk: "[木匠は道すがら、どの空き家の前でも歩みを緩めて二度見していく]",
        mutter:
          "「（独り言）この家の基礎はまだいい……あっちの屋根は次の台風は持たないだろうな。」",
        narrationDoor:
          "[目当ての空き家に着くと、彼は戸口でしばらく立ち止まり、すぐには中に入らなかった]",
        playerAsk: "主人公：「この家、どう思う？」",
        ok: "「……悪くない。」",
        builtMany:
          "「今まで何軒も家を建ててきた。全部人のためにだ。自分が住む家を建てるのは、これが初めてだ。」",
        odd: "「なんだか変な感じだ。」",
        materialsAsk: "「材料の話だが——木材と石材、どれくらい用意できる？」",
      },
      moveIn: {
        narrationLight: "[初めて窓に明かりが灯る。木匠は自分の家の前に立ち、中から漏れる光を見つめていた]",
        final:
          "「夜に家へ帰って、中で誰も俺の仕事を検分して待っていない——そう思えたのは、生まれて初めてだ。」",
      },
    },
    devtest: {
      wave: {
        narration_approach: "[村長は呼び止められ、一瞬立ち止まってから振り返って歩いてきた]",
        greeting: "「どうした、何か用か？」",
        follow_up: "「（笑って）よし、わかった。じゃあ、畑を見回りに行くよ。」",
      },
    },
  },
};

// ==============================================================
// NAME_LOOKUP——從上面 characters/places 衍生出「中文原文→譯文」對照表，
// 給 translateText() 的舊式原文查表用。單一資料源只有 TRANSLATIONS，這裡
// 純粹是推導，不要手動在 ui-translations.ts 另外重複打一次同樣的字串，
// 不然又會變回「兩份名字翻譯，改一個忘記改另一個」的老問題。
// 這樣一來，任何還沒切到 t() key 的舊呼叫點（例如 npc-defs.ts 的
// npcLine() 直接回傳 npc.name 這種原文字串）也能透過 translateText()
// 自動吃到 characters/places 的翻譯，不用逐一改呼叫點。
// ==============================================================
function buildNameLookup(locale: Locale): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const namespace of ["characters", "places"] as const) {
    const zhGroup = TRANSLATIONS.zh[namespace] as
      | Record<string, string>
      | undefined;
    const localeGroup = TRANSLATIONS[locale][namespace] as
      | Record<string, string>
      | undefined;
    if (!zhGroup || !localeGroup) continue;
    for (const key of Object.keys(zhGroup)) {
      const zhText = zhGroup[key];
      const translated = localeGroup[key];
      if (typeof zhText === "string" && typeof translated === "string") {
        lookup[zhText] = translated;
      }
    }
  }
  return lookup;
}
const NAME_LOOKUP: Record<Locale, Record<string, string>> = {
  zh: {},
  en: buildNameLookup("en"),
  ja: buildNameLookup("ja"),
};

// ==============================================================
// 瀏覽器 console 切換語言的入口仍保留作除錯用途；正式入口在系統選單。
// typeof window，避免這個模組萬一被 Node 腳本 import 時噴錯。
// ==============================================================
if (typeof window !== "undefined") {
  (window as any).meadowtideI18n = {
    setLocale,
    getLocale,
    locales: SUPPORTED_LOCALES,
  };
}
