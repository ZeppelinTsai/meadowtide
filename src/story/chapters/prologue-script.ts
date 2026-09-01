import type { StoryCameraShot } from "../story-types";
import type { ComicCueKind, ComicCueSpec } from "../../comic-cue";
type DialogueLine =
  | string
  | {
      text: string;
      speaker?: string;
      name?: string;
      revealNameAfter?: { npcId: string; stage: 1 | 2 };
      comicCue?: ComicCueSpec;
      hidePortrait?: boolean;
    };
const mayor = (
  text: string,
  revealNameAfter?: { npcId: string; stage: 1 | 2 },
): DialogueLine => ({
  text,
  speaker: "mayor",
  name: "村長",
  revealNameAfter,
});
const captain = (
  text: string,
  revealNameAfter?: { npcId: string; stage: 1 | 2 },
): DialogueLine => ({
  text,
  speaker: "captain",
  name: "船長",
  revealNameAfter,
});
const mayorWithoutPortrait = (text: string): DialogueLine => ({
  text,
  speaker: "mayor",
  name: "村長",
  hidePortrait: true,
});
const cue = (
  text: string,
  actorId: string,
  kind: ComicCueKind,
): DialogueLine => ({ text, comicCue: { actorId, kind } });
const mayorCue = (text: string, kind: ComicCueKind): DialogueLine => ({
  text,
  speaker: "mayor",
  name: "村長",
  comicCue: { actorId: "mayor", kind },
});
const mayorReactingToPlayer = (
  text: string,
  kind: ComicCueKind,
): DialogueLine => ({
  text,
  speaker: "mayor",
  name: "村長",
  comicCue: { actorId: "player", kind },
});

// F4/C 鏡頭調整模式記錄；給「村長開始引路」事件使用。
export const PROLOGUE_GUIDE_CAMERA_SHOTS: StoryCameraShot[] = [
  {
    focusX: 46.39,
    focusZ: 23.78,
    zoom: 0.55,
    yaw: -2.55,
    pitch: 0.365,
    duration: 1.5,
  },
  {
    focusX: 46.54,
    focusZ: 19.44,
    zoom: 0.61,
    yaw: -0.462,
    pitch: 0.299,
    duration: 1.5,
  },
];
export const PROLOGUE_OPENING_CAMERA_SHOTS: StoryCameraShot[] = [
  {
    focusX: 46,
    focusZ: 20.42,
    zoom: 0.68,
    yaw: -0.438,
    pitch: 0.425,
    duration: 1.5,
  },
];

// 序章文字的單一資料源。鏡頭、走位與實際操作閘門留在 prologue.ts。
export const PROLOGUE_MARKERS = Object.freeze({
  grantRadishSeeds: "[村長交給主角九包蘿蔔種子]",
  lookAtAbandonedFarm: "[主角看向周圍堆滿石頭與樹枝的田地]",
  whyOnlyPlot: "「嗯？你問為什麼只有這一小塊整理好了？」",
  farmingComplete: "[玩家完成九格播種]",
  walkIrrigation: "[兩人沿著水渠往牧場另一側走]",
  walkRestArea: "[兩人繼續往前，來到牧場的休憩區]",
  enterFarmHouse: "[兩人進入牧場小屋]",
  foodQuestion: "「在蘿蔔成熟以前，我要吃什麼？」",
  captainWarehouseFade: "[船長前往倉庫取釣竿]",
  cookingComplete: "[玩家完成一份烤魚]",
});
export const PROLOGUE_SCRIPT: Record<string, DialogueLine[]> = {
  flyer: [
    "[主角搭船前往小島，拿起手中的招募傳單]",
    "『小島牧場主招募中——』",
    "『這裡曾有肥沃的田地、豐饒的海洋，以及一年四季都有人來訪的牧場。』",
    "『我們正在尋找一位新的牧場主，和島上的人一起，讓這片土地再次熱鬧起來。』",
    captain("「前面就到了，東西收一收吧！」"),
  ],
  tour: [
    mayor("「你就是新來的牧場主吧？歡迎來到這座島。一路上還順利嗎？」"),
    mayor(
      "「我是梅貝爾，這座島的村長。島上的人現在不多，所以雜貨店也暫時由我照看。」",
      { npcId: "mayor", stage: 1 },
    ),
    mayor(
      "「這艘船每天上午十點靠岸，下午四點離港。原則上星期一停航——今天是為了接你，才特別跑了一趟。」",
    ),
    mayor("「那麼，我們去你的牧場吧，跟我來。」"),
    "[村長帶主角來到島上的廣場]",
    mayor("「這裡是島上的廣場。以前人多的時候，慶典和市集都會在這裡舉辦。」"),
    mayorWithoutPortrait(
      "「靠近廣場最南邊的第一間店就是雜貨店。營業時間是上午十點到下午四點，星期一公休。」",
    ),
    mayorWithoutPortrait(
      "「沿著城鎮往西北走可以上山。不過今天要看的地方不少，山區就留給你之後慢慢探索吧。」",
    ),
    cue("[兩人接著來到城鎮東北方的牧場]", "player", "!"),
    mayor("「到了。這裡就是你未來的牧場。」"),
    mayor("「看起來……確實比我記得的還要荒涼一點。」"),
    mayor(
      "「房子雖然空了一段時間，但我偶爾都有過來整理，基本生活應該沒有問題。」",
    ),
  ],
  farming: [
    PROLOGUE_MARKERS.grantRadishSeeds,

    mayor("「先從這裡開始吧。這是九包蘿蔔種子，你試著種進田裡看看。」"),

    PROLOGUE_MARKERS.lookAtAbandonedFarm,

    mayorReactingToPlayer(PROLOGUE_MARKERS.whyOnlyPlot, "?"),

    cue("[村長短暫停頓]", "mayor", "..."),

    mayor("「……前一位牧場主人離開以後，這裡就一直沒有人正式接手。」"),

    mayor("「我偶爾會過來整理一下，不過人上了年紀，清理這些東西比想像中累。」"),

    mayor("「最後，也只來得及替你整理好這一小塊。」"),

    cue("[主角連忙搖頭，冒著汗表示自己不是在責怪她]", "player", "panicDrops"),

    mayor("「哈哈，不用急著道歉。至少現在，總算有人願意重新站在這塊田裡了。」"),

    mayor("「剩下的地方，就交給你按照自己的步調慢慢整理吧。」"),

    mayor("「先按下右下的種子圖示，把種子拿出來。」"),
    mayor("「站在田地上按下 E，就能播種。來，把這九格都種滿看看。」"),

    PROLOGUE_MARKERS.farmingComplete,

    mayor("「沒錯，就是這樣。」"),

    "[村長蹲下來看了看剛播種的土地]",

    mayor("「這片田連著池塘的引水系統。以前經營觀光牧場的時候就留下來了。」"),

    mayor(
      "「這麼久沒有人種東西，我本來還擔心它不能用了。前幾天試過，水倒是還流得很好。」",
    ),

    mayor("「所以播種後不用每天澆水。等作物成熟，就可以直接收成了。」"),

    PROLOGUE_MARKERS.walkIrrigation,

    "[一座空蕩蕩的動物小屋出現在眼前]",

    mayor("「這裡是以前的動物小屋。」"),

    mayor("「前一位牧場主人離開的時候，還留下了幾隻牛、羊和雞。」"),

    "[村長望向空蕩蕩的圍欄]",

    mayor("「那陣子我每天都得過來照顧牠們。」"),

    "[村長苦笑了一下]",

    mayor(
      "「後來我聯絡了本島認識的牧場，一隻一隻把牠們送走。至少都找到了願意照顧牠們的人。」",
    ),

    mayor(
      "「所以現在這裡是空的。你不用急著把牠們買回來，等牧場穩定一點再說。」",
    ),

    mayor(
      "「等你準備好，我可以從雜貨店聯絡本島的店家。挑選並付款後，動物隔天就會搭船送過來。」",
    ),

    mayor("「到時候我再教你怎麼照顧牠們。」"),

    PROLOGUE_MARKERS.walkRestArea,

    mayor("「這裡以前是座觀光牧場，所以還留著給遊客吃東西、休息的地方。」"),

    mayor("「旁邊那座小花園也是。只是牧場關掉以後，就慢慢荒掉了。」"),

    "[村長看向荒蕪的花園，又回頭看了看剛播種的田地]",

    mayor("「我這幾年做的，其實也只是別讓這裡壞得太快。」"),

    mayor("「真正要讓它重新變成一座牧場，就不是我這把老骨頭做得到的事了。」"),

    "[村長轉向主角，笑了笑]",

    mayor("「所以接下來，要種什麼、養什麼、把這裡變成什麼樣子……就交給你了。」"),
  ],
  house: [
    PROLOGUE_MARKERS.enterFarmHouse,
    mayor("「這就是你的住處。家具不多，但爐灶、床和基本用品都還能使用。」"),
    mayor(
      "「使用床鋪可以讓時間快速經過。你可以睡到隔天早上六點，或休息到今天傍晚六點。」",
    ),
    mayor("「大致上就是這些。還有什麼想問的嗎？」"),
    PROLOGUE_MARKERS.foodQuestion,
    cue("[村長愣住]", "mayor", "!"),
    mayorCue("「……哎呀。」", "sweatFace"),
    mayor(
      "「對不起，我居然忘了最重要的事。島上現在還沒有餐館，總不能讓你餓著等蘿蔔長大。」",
    ),
    "[村長交給主角三條魚、三根蘿蔔和三朵蘑菇]",
    mayor("「這些是我早上向船長買來的補給。你先拿去應急吧。」"),
    "「可是吃完之後呢？」",
    mayor("「說得也是，光靠這些撐不了幾天……」"),
    cue("[村長停頓了一下]", "mayor", "..."),
    mayorCue("「糟糕，我是不是連釣竿也忘了準備？」", "gloom"),
    mayor("「真不好意思。我們去問問船長吧，他現在應該還在港口。」"),
    "[村長進入同行狀態。港口在東邊；黃色地板代表可進入區域]",
  ],
  fishing: [
    "[兩人回到港口]",
    captain("「嗯？新來的牧場主，這麼快就遇到麻煩了？」"),
    mayor("「是我的問題。我忘了替人家準備釣竿，你這裡還有備用的嗎？」"),
    captain("「這可不是小事。島上沒餐館，再沒有釣竿，今晚真得餓肚子了。」"),
    captain("「等著，我去倉庫找找。」"),
    PROLOGUE_MARKERS.captainWarehouseFade,
    captain("「找到了，給你吧。」"),
    "[獲得釣竿]",
    mayor("「真是不好意思。太久沒有新人搬來，我以為自己都準備好了……」"),
    captain("「這支釣竿，其實是上一任村長留下的。」"),
    captain(
      "「那老傢伙以前總愛拿著它來找我，說港口的魚比巡村時遇到的人好說話。」",
    ),
    mayor("「……原來你還留著他的東西。」"),
    captain("「我和他認識那麼多年，哪有說丟就丟的道理。」"),
    captain(
      "「妳接下他的村長工作以後，也沒什麼空來釣魚。現在交給新牧場主，正好。」",
    ),
    mayor("「嗯。他要是知道自己的釣竿又派上用場，一定會很高興。」"),
    captain("「妳丈夫要是知道，八成會在那邊得意得不得了。」"),
    mayor("「呵呵，那倒是真的。」"),
    captain(
      "「說起來，我還沒跟你自我介紹是吧。我叫赫克托，是這艘補給船的船長。」",
      { npcId: "captain", stage: 1 },
    ),
    captain("「都拿出來了，我就順便教你怎麼用吧。到南邊的沙灘試試，那裡比較安全。」"),
    captain(
      "「裝備釣竿後，面向水邊按下 E，就能拋竿。魚上鉤時會出現提示，要把握時機收竿。」",
    ),
    captain("「先試一次，我在旁邊看著。」"),
  ],
  fishingFailed: [
    captain("「別在意，第一次失手很正常。看準魚咬鉤的提示，再試一次吧。」"),
  ],
  fishingSuccess: [mayor("「釣到魚了呢！那我們回牧場小屋去吧。」")],
  cooking: [
    mayor("「接下來是料理。我先教你烤蔬菜、海鮮湯和烤蘑菇串三道食譜。」"),
    mayor("「爐灶就在屋子的右上角，走近調查後，挑其中任何一道做出來就好。」"),
    mayor(
      "「廚房現在只有最基本的炊具，能做的料理還不多。先試著做一份料理吧。」",
    ),
    PROLOGUE_MARKERS.cookingComplete,
    mayor("「很好，聞起來不錯。」"),
    mayor(
      "「不同料理除了恢復體力，也可能帶來暫時效果。出門前吃對料理，做事會輕鬆不少。」",
    ),
    mayor("「種田、釣魚和料理，你都已經會了。剩下的不用急，慢慢來就好。」"),
    mayor("「這一週應該還會有幾個人來到島上。有人抵達時，我會去牧場通知你。」"),
    mayor("「最後，這張島嶼地圖交給你。按下 M 或 View 就能查看地圖。」"),
    "[村長將島嶼地圖交給主角]",
    mayor("「那麼，歡迎來到島上，牧場主。」"),
  ],
};
