import { hash2 } from "./utils";
import { repaintRegion } from "./region-paint";
import { shiftMapLayout } from "./map-shift";

// ==============================================================
// 統一佈局設定 —— 之後要調哪個區域的位置/大小，改這裡就好，不要再
// 回頭找散落各處的絕對座標。房子、穀倉、牧場這次先不動，農田往西
// 移、湖放大到接近 10×10、山搬進西側緩衝帶。要放在 MAPS 前面，因為
// 下面 buildings 陣列會直接引用這裡的值
// ==============================================================
export const NORTH_EXPANSION = 5;
// 兩組「純裝飾、不用真的能走」的石梯(住家傳送點 homeStoneStairs、
// 生活區山門 mountainGateway)2026-08-26 統一成同一套坡度/寬度——
// 原本一個 ~30°、一個(修正山坡貼合後)~30°但另一組修正前是 ~65°，
// 玩家要求兩邊看起來一致，統一抓 60°(比一般樓梯陡，符合「鑿進山壁
// 的石梯」調性)；寬度統一 3 格，跟兩邊各自的傳送門檻(width:3，見
// homeGate/MOUNTAIN_GATE_BLOCKER)對齊，不用另外記一個不一樣的數字。
// 2026-08-26：60→45，玩家要求試試看較緩的角度。
export const STAIR_SLOPE_DEGREES = 50;
export const STAIR_SLOPE_TAN = Math.tan((STAIR_SLOPE_DEGREES * Math.PI) / 180);
export const DECORATIVE_STAIR_WIDTH = 3;
// 舊城鎮波上宮與 mountain (20,14) 共用的地標鳥居尺寸。
export const LANDMARK_TORII_SCALE = 2;
export const LAYOUT = {
  livingArea: {
    fences: [
      { x1: 0, x2: 18, z1: 42, z2: 42 },
      { x1: 24, x2: 33, z1: 42, z2: 42 },
      { x1: 33, x2: 33, z1: 37, z2: 42 },
      { x1: 24, x2: 24, z1: 37, z2: 42 },
    ],
    oldVillageGate: { x: 20, z: 42, width: 3 },
    prologueArrival: { player: { x: 21, z: 41 }, mayor: { x: 20, z: 41 } },
    portGate: { x: 34, z: 42, width: 14 },
    gatherZone: {
      x: 0,
      z: 3,
      width: 3,
      depth: 34,
      mountainGateClearance: 3,
    },
  },
  // 北側新增 5 排：動物區留在新空間，其餘舊區域整體往南順延。
  house: {
    x: 20,
    z: 9 + NORTH_EXPANSION,
    w: 3,
    d: 2,
    doorX: 21,
    visualScale: 2,
    doorWorldHeight: 1.05,
  },
  barn: {
    x: 20,
    z: -7,
    w: 3,
    d: 2,
    doorX: 21,
    visualScale: 2,
    doorWorldHeight: 1.05,
  }, // 整座動物小屋向左移 3 格；2026-09-03 再往北(-5)搬，見 pasture 註解
  // 2026-09-03：Zeppelin 覺得牧草地不夠大，把小屋/圍籬/北側懸崖(玄武岩)
  // 整組往北挪 5 格(barn.z -2→-7、NORTH_CLIFF_Z、NORTH_TERRAIN_EXTENSION
  // 同步 -5/+5，見 scene-sky.ts)，挪出來的 5 排空間直接併回牧草地——
  // 南緣(z+height-1=13)刻意維持原值不動，只有北緣往外長，房子/農田/
  // 池塘等其餘區域完全不受影響。北側平台(z<0)本來就是
  // isBlocked()(build-map.ts)特別放行的可走區域，不需要真的擴張
  // tiles 陣列本身。
  // 2026-09-04：果園(orchard)跟東側海面(build-map.ts 的 minZ)這次補一起
  // 往北移/擴，見各自欄位旁的註解。
  pasture: { x: 17, z: -7, width: 15, height: 21 }, // 延伸到小屋左右，外緣由渲染做不規則化
  orchard: {
    x: 28,
    z: -1 - 5, // 2026-09-04 跟牧草地北擴同一批，果園也往北移 5 格
    columns: 3,
    rows: 4,
    spacingX: 2,
    spacingZ: 2.1,
  }, // 小屋右側 12 棵
  windmill: {
    x: 29,
    z: 13,
    w: 4,
    d: 4,
    visualX: 30.5,
    visualZ: 14.5,
    scale: 2,
  },
  houseRoad: { width: 3 },
  farmAccessRoad: { width: 3 },
  coastRoad: { width: 3 },
  restArea: {
    x: 25,
    z: 24,
    width: 8,
    height: 6,
    chair: { offsetX: 2, offsetZ: 4, rotation: 0, playerRotation: Math.PI, sittable: true },
  },
  garden: { x: 25, z: 31, width: 8, height: 7 },
  // 蜂箱系統預留點——花田(garden)南緣 z=37 再往南 2 格的開闊草地，
  // map-debug --map=livingArea --legend 已確認是平坦草地、不在花田/
  // 林蔭道(x≈20-23)/任何建築範圍內。座標本身跟遊戲進度無關，蜂箱
  // 「有沒有蓋出來」由 storyState.flags["beehive.unlocked"] 控制
  // (見 game-state.ts)，這裡只先佔位。
  beehive: { x: 29, z: 39 },
  oysterFarm: { x: 46, z: 14, spacing: 2 },
  farm: {
    x: 5,
    z: 17 + NORTH_EXPANSION,
    columns: 3,
    rows: 4,
    plotSize: 3,
    gap: 1,
  }, // 3 欄 × 4 排，共 12 塊田
  lake: {
    x: 2,
    z: 0,
    width: 18,
    height: 17,
    // 左上岸六棵遮陽樹；沿湖水外緣排列，用相對座標讓湖搬遷時一起移動。
    shadeTreeOffsets: [
      [7, 0],
      [6, 1],
      [5, 2],
      [5, 3],
      [5, 4],
      [4, 5],
    ],
    // 最下面一棵維持貼岸，其餘五棵的樹幹視覺稍微往左退。
    shadeTreeVisualShiftX: -0.5,
  },
  coast: {
    eastExpansion: 5,
    rampX: 34,
    rampWidth: 3,
    sandCols: 10,
    // 從 10 加到 16：女神祠堂步道往東延伸後幾乎頂到原本的陣列邊界，
    // 每排一定要留至少一格真的海(9)，海面西緣偵測(westXByZ，逐排找
    // row.indexOf(9))才不會因為整排都被改成沙灘而找不到海、退化成
    // 沿用鄰排的舊海岸線，導致海面網格蓋住新沙灘（曾經真的踩到這個坑）。
    oceanCols: 16,
  },
  // slopeEastX/slopeWestX 是 makeWesternMountainTerrain(props.ts)那片
  // 山坡地形本來就有的兩個端點常數，原本各自寫死在函式裡沒有共用出
  // 來；2026-08-26 這裡補成正式欄位，讓 mountainGateway 的裝飾石梯
  // 可以讀同一組數字算「山坡在這個 x 位置到底多高」，兩邊才不會各
  // 用各的座標系統。
  mountainBand: {
    x: -7,
    width: 6,
    slopeDegrees: 30,
    slopeEastX: -0.25,
    slopeWestX: -34,
    // 第一人稱可看見高台側面；填充 Z 範圍直接沿用山坡本體的 northZ/southZ。
    footFillBottomY: -12,
  },
  mountainGateway: {
    startX: 3,
    startZ: 20,
    steps: 4,
    risePerStep: 0.2,
    width: 1.65,
    // 生活區西側外接石梯的視覺落點：最後一階（樓底）朝右並對準
    // x=-1、z=17。邏輯門檻仍在合法的 x=0，不把負座標寫進 tile 陣列。
    //
    // 2026-08-26 三次調整：上一版把每階下降量貼著山坡地形的 30°
    // 緩坡算(避免鑽進地表被蓋住)，副作用是「樓梯最底那階(最靠近
    // 草地、玩家會先踩到的那階)」被墊到跟山坡同高，離實際草地地面
    // 還有一大截，看起來像第一階特別高。玩家要求跟住家那組(60°)
    // 統一角度+寬度，這裡改成：樓底(最後一階)直接釘在真正的地面
    // 高度(PLATEAU_Y+0.08，算法見 props.ts 的 makeMountainGateway())，
    // 樓梯用固定 60° 往山裡爬升，不再逐階比對地形；水平總長也從
    // 5.58(=0.62×9)收到 2.5(=0.5×5)，60° 本來就陡，鋪太長頂端會
    // 爬到明顯浮在山坡視覺範圍以上，收短一點讓浮起的量沒那麼誇張
    // (仍會有一點飄在山坡表面之上——60° 比山坡本身的 30° 陡，兩者
    // 不可能全程貼合，這是兩個角度不同必然的取捨，只把量壓到不
    // 明顯的範圍)。
    // 2026-08-26 五次調整：整組樓梯往右(+x)移動 1 格(-1→0)，樓底
    // 對齊真正的合法傳送門檻(MOUNTAIN_GATE_BLOCKER.x=0)，不再落在
    // 門檻再往西一格的位置。
    // 2026-08-26 六次調整：再微調 +0.5(0→0.5)。
    // 2026-08-26 七次調整：往左一格(0.5→-0.5)。
    visualBottomX: 0,
    visualZ: 17,
    visualSteps: 6,
    visualRun: 0.5,
  },
  oldVillage: {
    width: 77,
    // 整個城鎮(除了南側新沙灘)統一墊高 1(mountainLanding/upper/middle/
    // 廣場預設地面 groundElevation 全部各自 +1)，保留原本的三層地形
    // 相對關係，不是把 middle 跟廣場拉平到同一層——第一版誤把兩者拉
    // 平、順手拿掉了 middle→廣場的樓梯(plazaStairs 的 z=16 那段、
    // westStairs 的 z19~26 那段)，是判斷錯誤，已還原並依統一 +1 更新
    // 高度。groundElevation(=1)數值特地跟 LAYOUT.port.elevation 一樣，
    // 是刻意讓兩個城鎮地圖同一套「墊高平台+階梯下到沙灘」語彙。
    //
    // 南側新擴充部分：現有城鎮地面(z<30，墊高後)直接接一小段階梯(併進
    // westStairs 陣列共用既有樓梯渲染/collision，不用另外寫一套、也
    // 不另外墊一塊台地)下到沙灘/海。southBeach.z=30(不是南側新增區域
    // 的最前緣 34)，因為階梯只佔 x=28~34 這一小段寬度，寬度以外的
    // 全部欄位在 z=30 就已經直接落到沙灘(0)——不然階梯以外的欄位會
    // 卡在墊高後的地面(1)一路到 z=34 才下海，變成階梯以外的地方有一
    // 道看不見、走不下去的懸崖(先前正是這個原因走不到沙灘)。depth 仍
    // 是 30，跟港口南沙灘同一個數字、同一套「先鋪滿海、再依 x 算的
    // 鋸齒海岸線疊沙」寫法。沙灘本身維持 elevation 0，跟
    // makeSand()/水面貼圖寫死的海平面基準一致。
    height: 64,
    groundElevation: 1,
    southBeach: { x: 30, z: 30, width: 47, depth: 30 },
    // 西側新沙灘——跟南側新沙灘同一套「先鋪滿整段海，再依座標算
    // 鋸齒岸線疊沙」寫法（見 makeOldVillageTiles()/
    // oldVillageWestBeachStartX()），只是換成沿 z 逐排、往東(靠近
    // 城鎮那側)疊沙、往西(x=0，地圖真正邊界)維持海。寬度(30 格)
    // 跟南側沙灘的 depth 同一個數字，純粹是這次需求指定的量，不是
    // 公式推導出來的巧合。加了這塊之後，原本西側(westStairs/
    // mountainGate/houses…)全部整批 +30，把 x=0~29 空出來給沙灘，
    // 不是在原地改地形——用法比照 map-shift.ts 的
    // shiftRegisteredMap(西移 amount=30)：地磚陣列往西 unshift 30
    // 欄，這張地圖底下所有帶 x 座標的資料(這個物件本身、
    // MAPS.oldVillage.placeholders/houses)全部同步 +30，這次是手動
    // 展開改在這份字面量裡，沒有真的呼叫那個 runtime 工具——
    // build-map.ts 那邊有幾個沒有走 LAYOUT 的寫死 x 數字(三塊
    // addTerrace 的 xStart、OLD_VILLAGE_RAILS 前兩段)另外手動對應
    // 調整，這個工具目前不會幫忙掃到那些。
    westBeach: { x: 0, z: 0, width: 30, height: 64 },
    // 位於西北岸、以世界座標 (100,37) 正北側為基準的 11x26 沙灘。
    // 這裡先記錄西擴前的 x=-5；下方 OLD_VILLAGE_OCEAN_EXPANSION 會把
    // LAYOUT.oldVillage 整體 +100，最後落在 x=95~105、z=11~36。
    // 2026-08-26：北緣從 z=16 往北(減)推到 z=11，多出來的 5 排是為了
    // 配合主殿(northBeachPlatform.cube)一起往北移，讓主殿跟鳥居(torii)
    // 之間的空地變大；南緣(z=36)沒動，東南側 EastFill/EastShelf/
    // SouthEdge 等南側收尾規則都不受影響。
    northBeach: { x: -5, z: 11, width: 11, height: 26 },
    // 核心沙灘北／西／東側向外錯落 0~2 格；陣列索引依各邊由小座標往大座標。
    // westDepths/eastDepths 是以 northBeach.z 為 index 0 的「定位索引」
    // (z = northBeach.z + index)，不是絕對座標——2026-08-26 把
    // northBeach.z 往北推 5 之後，兩個陣列各自在最前面「插入」5個新值
    // (對應新的 z=11~15)，讓原本第 0 項開始對到的 z=16 那些舊資料
    // 整組往後挪 5 格、繼續對到同樣的 z，南側(z=31~35)原本已經調好的
    // 鋸齒岸線因此不會被打亂；新插入的 5 個值純粹是延續風格隨手排的
    // 鋸齒(0~2 之間)，沒有特別的美術依據。
    northBeachOuterFringe: {
      northDepths: [1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1],
      westDepths: [1, 2, 0, 1, 2, 1, 2, 1, 0, 2, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1],
      eastDepths: [2, 0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2, 1],
    },
    // 東南側補沙，西擴後落在指定的 x=105~115、z=35~36。
    northBeachEastFill: { x: 5, z: 35, width: 11, height: 2 },
    // 西擴後固定覆蓋 x=105~117、z=34，並向北錯落延伸 0~2 格。
    northBeachEastShelf: {
      x: 5,
      z: 34,
      northDepths: [1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 2],
    },
    // 西擴後落在 x=107~112、z=32；最後覆寫為海，切開東側沙灘輪廓。
    northBeachEastSeaCutout: { x: 7, z: 32, width: 6, height: 1 },
    // 西擴後為 (101,36)、(100,34)；在所有岸線規則後最後覆寫為沙灘。
    northBeachSandCorrections: [
      { x: 1, z: 36 },
      { x: 0, z: 34 },
    ],
    // 西擴後分別為 x=107,z<=34 與 x=93,z<=33；只把其中原本的沙格退回海。
    northBeachSeaTrims: [
      { x: 7, maxZ: 34 },
      { x: -7, maxZ: 33 },
    ],
    // 平台由四個彼此貼合、正常寫深度的實心方塊組成；輪廓左右只偏 1 格。
    // 最南段仍以 z=31 銜接樓梯頂端，所有段共用同一高度與材質規則。
    // 2026-08-26：主殿(cube)覺得離鳥居(torii, z=28)太近，整個往北(z
    // 減 5：20→15)移動；segments[0] 跟著改成 z=13/depth=8，並且寬度從
    // 5 拓寬成跟 segments[1] 一樣的 7(x:-3, 跟 segments[1] 同一個 x)，
    // 讓 segments[0]/[1] 在 x 方向完全對齊、z=13~27 連成一塊沒有寬度
    // 落差的矩形——原本 segments[0] 只有寬 5(跟 cube 同寬)，[1] 寬 7，
    // 兩段交界(z=21)會有 1 格的「懸崖凸出去」錯位(Zeppelin 回報的
    // (104,21-22)/(103,21)/(97,21))；玄武岩柱群跟 makeNorthBeachPlatformRails()
    // 的扶手都是從 segments 動態算輪廓，寬度對齊後兩邊都會自動變乾淨，
    // 不用另外改。**注意：修這個問題時特意選「拓寬 segments[0]」而不是
    // 「segments[1] 的 z 往北延伸蓋掉 segments[0] 的範圍」——後者會讓兩段
    // 在 z 方向重疊，`oldVillageNorthPlatformBounds()` 用 .find() 只抓陣列
    // 裡第一個 z 命中的 segment，重疊區間會一直吃到 segments[0] 的窄邊界，
    // 視覺上鋪的是寬台地、站上去卻可能吃到窄邊界外的碰撞判定，人物會在
    // 看起來明明是平台的地方掉出去/浮空。segments 之間 z 範圍必須保持
    // 彼此不重疊，這是這個資料結構的硬性前提。
    // segments[1..3]、torii 都沒動，平台本身仍是 13→32 連續一片，
    // 玩家從主殿走到鳥居/樓梯的路徑不變，只是主殿視覺上退後了、跟
    // 鳥居之間的廣場空間變大。
    northBeachPlatform: {
      elevation: 3,
      // 2026-08-26：Zeppelin 回報神社那邊「樓梯平台重疊閃爍」——南端樓梯
      // (westStairs 最後一段，x:-1,fromZ:31,toZ:34)是刻意設計成「z=31
      // 頂端切入平台」，樓梯自己的階梯 box 在 z 方向用 fromZ/toZ 當真實
      // 邊界(沒有 ±0.5 的 tile 緩衝)，物理範圍就是 [31,34]。但下面
      // {x:-3,z:29,width:7,depth:3} 這塊平台是用一般的「z ± 半格」tile
      // 慣例算出實際範圍 [28.5,31.5]——兩邊在 z:31~31.5 這 0.5 格內都是
      // 實心方塊、同一個高度(elevation=3)，疊在同一個位置，這正是
      // z-fighting 閃爍的成因。depth 從 3 改成 2.5，讓這塊平台的南緣
      // 精準停在 z=31(樓梯實際幾何的起點)，不再跟樓梯重疊。
      segments: [
        { x: -3, z: 13, width: 7, depth: 8 },
        { x: -3, z: 21, width: 7, depth: 6 },
        { x: 4, z: 21, width: 1, depth: 2 },
        { x: -4, z: 27, width: 8, depth: 2 },
        { x: -3, z: 29, width: 7, depth: 2.5 },
        // 外圈只局部多一格，保留主殿、鳥居與南側樓梯的大結構。
        { x: -4, z: 15, width: 1, depth: 2 },
        { x: 4, z: 18, width: 1, depth: 2 },
        { x: -4, z: 24, width: 1, depth: 2 },
        { x: 4, z: 27, width: 1, depth: 1 },
        { x: -4, z: 30, width: 1, depth: 1 },
      ],
      torii: { x: 0, z: 28, scale: LANDMARK_TORII_SCALE },
      cube: { x: -2, z: 15, width: 5, depth: 6, height: 1.6 },
    },
    // 女神是北側祠堂平台上的純視覺角色。這裡使用西擴前座標，
    // MAP_SHIFT_REGISTRY 會隨 oldVillage 西擴 100 格後變成 (100,22)。
    goddess: { x: 0, z: 22 },
    // x=95~115 的南岸每欄在 z=35~37 之間小幅進退；固定序列避免載圖漂移。
    northBeachSouthEdge: {
      x: -5,
      z: 36,
      endOffsets: [0, -1, 0, 1, 0, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, 0, -1],
    },
    stalactiteCave: {
      // 擴展到 x=29，剛好貼齊 westBeach(x:0~29)的東緣，跟乾地交界
      // 不留縫；入口跟著洞窟拓寬——從 22-23 移到 24-26，往東挪一點
      // 並加寬，配合新洞口尺寸重新調整過的石頭群(見 props.ts)。
      x: 20,
      z: 0,
      width: 10,
      depth: 6,
      entranceX: 24,
      entranceWidth: 3,
      entranceStartZ: 3,
    },
    southwestSeaCutout: {
      x: 11,
      z: 38,
      upperCoreEndX: 16,
      deepStartZ: 45,
      deepCoreEndX: 29,
      height: 26,
    },
    westExpansion: 36,
    houseVisualScale: 1.5,
    houseDoorWorldHeight: 1.05,
    livingGate: { x: 63, z: 0, width: 3 },
    prologueGuide: {
      arrival: { x: 75, z: 23 },
      corner: { x: 64, z: 23 },
      exit: { x: 64, z: 0 },
    },
    portGate: {
      x: 76,
      z: 4,
      height: 44,
      beachStartZ: 30,
      beachEndZ: 47,
    },
    mountainRoad: { x: 33, z: 29, width: 3 },
    // 2026-08-25 左右各擴張 1 格(從單點變 3 格寬)，跟 mountain
    // 側的 townGate/townArrival 一起改，對應的 mountainLanding
    // (x=30,width=3)本來就已經是 3 格寬，不用跟著調整。
    mountainGate: { x: 31, z: 0, width: 3 },
    mountainArrival: { x: 31, z: 1, width: 3 },
    plaza: { x: 58, z: 4, width: 18, height: 22 },
    // 統一 +1：upper 2→3、middle 1→2，跟 mountainLanding(3→4)、
    // groundElevation(=1，廣場預設地面)保持原本一路遞減的相對關係，
    // 三層地形＋廣場的落差都還在，只是整體墊高了一階。
    terraces: {
      upper: { maxZ: 9, elevation: 3 },
      middle: { minZ: 10, maxZ: 19, elevation: 2 },
      westEdge: 57.5,
    },
    mountainLanding: { x: 30, z: 0, width: 3, depth: 2, elevation: 4 },
    // upper(3)→廣場(1)：中間隔著 middle，落差變成 2(原本只差 1)。
    // middle(2)→廣場(1)：落差 1，跟統一 +1 之前一樣。
    plazaStairs: [
      {
        z: 7,
        width: 3,
        fromX: 55,
        toX: 58,
        baseElevation: 1,
        elevation: 2,
        steps: 6,
      },
      {
        z: 16,
        width: 4,
        fromX: 55,
        toX: 58,
        baseElevation: 1,
        elevation: 1,
        steps: 6,
      },
    ],
    westStairs: [
      {
        x: 30,
        width: 3,
        fromZ: 2,
        toZ: 7,
        baseElevation: 3,
        elevation: 1,
        steps: 6,
      },
      {
        x: 30,
        width: 3,
        fromZ: 9,
        toZ: 16,
        baseElevation: 2,
        elevation: 1,
        steps: 7,
      },
      {
        x: 30,
        width: 3,
        fromZ: 19,
        toZ: 26,
        baseElevation: 1,
        elevation: 1,
        steps: 7,
      },
      {
        x: 30,
        width: 3,
        fromZ: 30,
        toZ: 33,
        baseElevation: 0,
        elevation: 1,
        steps: 6,
      },
      // 南側新沙灘的下坡階梯——直接接在墊高後的城鎮地面(groundElevation
      // =1)後面，下到沙灘(0)。沿用同一個陣列/同一套 oldVillageGroundY()
      // 公式(z 越小值越高)，不用另外寫一份。fromZ(30)頂端 1，toZ(33)
      // 底端 0，緊接 southBeach。x 從 20 移到 28。
      {
        x: 58,
        width: 7,
        fromZ: 30,
        toZ: 33,
        baseElevation: 0,
        elevation: 1,
        steps: 6,
      },
      // 北側平台南端樓梯：西擴前 x=-1，擴張後位於 x=99~101。
      // 往北移兩格後，z=31 頂端切入高度 3 的平台，z=34 底端落回沙灘。
      {
        x: -1,
        width: 3,
        fromZ: 31,
        toZ: 34,
        baseElevation: 0,
        elevation: 3,
        steps: 6,
      },
    ],
    carpenterHouse: { x: 36, z: 13, d: 3, doorX: 37 },
    // w/d/doorX/wallColor/roofColor/role：10 棟對應使用者定案的城鎮
    // 角色設定(4/3/3 三排)。role 純粹是資料標籤，給 build-map.ts 挑
    // 對應的門口裝飾用，也方便之後其他系統(NPC 排程等)用名字找到
    // 特定房子，不影響 makeBuilding/makeBarn 的渲染。w 加倍的三棟
    // (學校/雜貨店兼行政中心/民宿)是使用者指定的「雙倍寬度」門面
    // 建築；doorX 因此改成新的置中值(x+(w-1)/2)，其餘座標不動——
    // 佔地仍是單格 tile=1(見 makeOldVillageTiles)，不影響碰撞跟既有
    // 的城鎮<->生活區/港口/美術村事件。原本 3 棟的 style:"barn"(穀倉
    // 雙開門+閣樓圓窗)拿掉了：新角色沒有一棟適合穀倉造型，統一用
    // makeBuilding，靠顏色+門口裝飾物做區分。carpenterHouse(6,24)
    // 沒有 wallColor/roofColor，維持原本的 makeTownPlaceholder 佔位
    // ——那間是木匠事件用的「還沒整修好」空屋，施工告示牌/入住後的
    // 發光窗戶都是靠劇情 stage 另外疊上去的(見 build-map.ts)，太早
    // 把它做漂亮會跟「這間需要修」的敘事衝突，等木匠劇情真的做到
    // 那一步再回頭一起處理。
    houses: [
      // 2026-09-05 Zeppelin 全盤重新配置城鎮 10 棟房子(西→東、北→南)：
      //   第一排：社區中心／醫院／醫生家／護士家
      //   第二排：木匠家／藝術家家／雜貨店(離廣場最近那棟)
      //   第三排：海洋學家家／植物學家家／民宿
      // 這次重排順便把舊的「role 標籤跟中文註解對不上」的debt清乾淨——
      // 原本 x36,z13 role:"carpenter" 卻寫著「老師家」註解、x36,z23
      // role:"teacher" 卻寫著「木匠家」註解，兩邊註解互相搬過去而已，
      // role 本身沒有跑錯(build-map.ts 的裝飾/木匠劇情邏輯都是照 role
      // 字串找房子，一路都是對的)，現在 role 跟註解終於一致。
      {
        x: 35,
        z: 4,
        seed: 0.18,
        w: 4,
        d: 3,
        doorX: 36.5,
        role: "communityCenter",
        wallColor: 0xe4c9a0,
        roofColor: 0x7a2e2e,
      },
      // 醫院——白牆+藍灰屋頂的醫療配色，門口上方掛紅十字招牌。
      {
        x: 41,
        z: 4,
        seed: 0.34,
        w: 3,
        d: 3,
        doorX: 42,
        role: "hospital",
        wallColor: 0xf2f0ea,
        roofColor: 0x3a5a72,
      },
      // 醫生家——跟醫院同一套藍調但降一階彩度，門口掛小十字牌。
      {
        x: 46,
        z: 4,
        seed: 0.52,
        w: 3,
        d: 3,
        doorX: 47,
        role: "doctor",
        wallColor: 0xd7e3e6,
        roofColor: 0x4a5a5e,
      },
      // 護士家——淺薄荷綠牆+暖陶土屋頂，跟醫生家同組但用色區分開來。
      {
        x: 51,
        z: 4,
        seed: 0.68,
        w: 3,
        d: 3,
        doorX: 52,
        role: "nurse",
        wallColor: 0xdce8dc,
        roofColor: 0x8a5a42,
      },
      // 木匠家——暖芥末黃牆面。role:"carpenter" 這棟故意不在 build-map.ts
      // 的靜態門口裝飾清單裡(木匠有自己一套「施工告示牌/入住後發光
      // 窗戶」的劇情 stage 動態疊加邏輯，跟 CARPENTER_HOUSE/
      // CARPENTER_DOORSTEP 這組座標綁在一起，見下面木匠事件那段)，
      // 不要另外幫它加靜態裝飾，會跟施工中的敘事衝突。
      {
        x: 36,
        z: 13,
        seed: 0.27,
        w: 3,
        d: 3,
        doorX: 37,
        role: "carpenter",
        wallColor: 0xd8c078,
        roofColor: 0x5a4530,
      },
      // 藝術家家(露比)——2026-09-05 從原本(42,23)搬到這裡，跟她 Day2
      // 個人事件實際發生的位置(ARTIST_EVENT_WAIT_POS=142,18，換算回這
      // 排西擴前座標正好是 42,13)對齊，之前 role 標籤跟事件實際站位
      // 對不上的問題就此解決。牆色帶灰黃底、偏舊白，呼應她 Day2 那段
      // 「你覺得這面牆是白色的嗎？有一點灰、一點黃……下面還留著雨水
      // 流過的顏色」——原本粉調牆面(0xd6a0c4)一眼就是粉紫色，跟台詞
      // 邏輯對不上；梅紫屋頂延續原本設定不變，台詞只提到牆。
      {
        x: 42,
        z: 13,
        seed: 0.46,
        w: 3,
        d: 3,
        doorX: 43,
        role: "artist",
        wallColor: 0xd6d0b8,
        roofColor: 0x5a3a6a,
      },
      // 雜貨店兼行政中心——雙倍寬度，第二排離廣場(plaza.x=58 起)最近
      // 的一棟，整個城鎮視覺上的商業/行政門面：遮陽棚+吊招牌。座標
      // 沒動(本來就在這，2026-09-03 那組開發用捷徑傳送點才是真的沒對
      // 齊，見下面 build-map.ts GENERAL_STORE_DOORSTEP 那段)。
      {
        x: 48,
        z: 13,
        seed: 0.73,
        w: 4,
        d: 3,
        doorX: 49.5,
        role: "generalStore",
        wallColor: 0xd9a94a,
        roofColor: 0x2f6b63,
      },
      // 海洋學家家——2026-09-05 從(42,13)搬到這裡，把原本第二排中間
      // 的位置讓給藝術家家。藍綠牆面+風化灰藍屋頂、門口簡化船舵裝飾
      // 都原封不動搬過來，只是換了地址。
      {
        x: 36,
        z: 23,
        seed: 0.22,
        w: 3,
        d: 3,
        doorX: 37,
        role: "oceanographer",
        wallColor: 0x9fc4c9,
        roofColor: 0x33525c,
      },
      // 植物學家家(克拉拉)——2026-09-05 新增，第三天早上個人事件
      // (day3-morning-event.ts/botanistQuest)登場前她本來就沒有一棟
      // 城鎮房子，這是第一次補上。淺草綠牆+深綠屋頂呼應她在
      // npc-defs.ts 的角色識別色(shirt: 0x6b8f5a)，跟其他 9 棟房子的
      // 色系都不重複。門口裝飾先留白，之後想加花缽/種子袋之類的道具
      // 再回頭補(build-map.ts 目前沒有 villageHouseByRole("botanist")
      // 的裝飾區塊)。
      {
        x: 42,
        z: 23,
        seed: 0.57,
        w: 3,
        d: 3,
        doorX: 43,
        role: "botanist",
        wallColor: 0xdde5c4,
        roofColor: 0x4a6b3a,
      },
      // 民宿——雙倍寬度，門口一支吊招牌+一盞燈籠，比住宅群更有「迎賓」
      // 的存在感。
      {
        x: 48,
        z: 23,
        seed: 0.81,
        w: 4,
        d: 3,
        doorX: 49.5,
        role: "guesthouse",
        wallColor: 0xdcb894,
        roofColor: 0x4a3428,
      },
    ],
  },
  mountain: {
    width: 38,
    height: 68,
    // 2026-08-25 左右各擴張 1 格(從單點變 3 格寬)，對應 oldVillage
    // 側的 mountainGate/mountainArrival 一起改；lowerStair(x=21,
    // width=3)本來就已經是 3 格寬的走道，不用跟著調整。
    townGate: { x: 22, z: 67, width: 3 },
    // 傳送點+石梯+扶手整組 2026-08-25 往右(+x)移動 1 格——homeGate
    // 33/homeArrival 31，碰撞跟傳送觸發全部是讀這幾個欄位算出來的，
    // 改這裡就全部跟著動，不用動 build-map.ts。x=34 會超出 waist
    // 平台的實際邊緣(centerX+halfWidth=20+13.5=33.5，再往右一格
    // 地磚是沒塗色的實心岩壁、地面高度也會直接掉回 0)，暫時不再
    // 往右移，先把石梯/扶手跟平台邊界接好(見下一則)。
    // 2026-08-26 傳送點上下(z)各擴張 1 格，同一組 count/index offset
    // 手法，在 build-map.ts 的觸發事件那邊做；這裡補 width:3 只是
    // 標記涵蓋範圍，跟 mountainGate/townGate 那組 width 欄位同用途。
    homeGate: { x: 33, z: 34, width: 3 },
    townArrival: { x: 22, z: 65, width: 3 },
    homeArrival: { x: 31, z: 34, width: 3 },
    skyPalaceGate: {
      trigger: { x: 18, z: 12 },
      arrival: { x: 18, z: 13 },
    },
    summitShrine: {
      x: 25.5,
      z: 8.5,
      guardianOffsetX: -1.7,
      collisionHalfWidth: 0.75,
      collisionHalfDepth: 0.55,
    },
    // 2026-08-25 二次調整：x 從 32.65 改成 33.5，貼齊 waist 平台邊界
    // (centerX+halfWidth=33.5，跟 build-map.ts addPlatform() 算的
    // 是同一個數字)——石梯第一階緊接平台邊緣，不再留一小截空隙。
    // 同時 build-map.ts 的 isTransferOpening 那組圓形門檻改成專屬
    // 的 isHomeStairJoin(固定方形收邊，跟 lowerStair/upperStair 那組
    // isStairShoulder 同一種手法)，平台圍欄會精準停在石梯扶手兩側
    // 的起點，兩段扶手才會接起來，不再是圓弧缺口配直線樓梯對不上。
    // 2026-08-26 四次調整：width 從 1.85 擴到 DECORATIVE_STAIR_WIDTH(3)，
    // 跟剛擴張過的傳送門檻(homeGate.width=3)對齊(玩家反饋「山邊的
    // 樓梯也上下擴展一格」)；dropPerStep 從寫死的 0.34 改成用共用
    // 的 STAIR_SLOPE_TAN 現算，跟生活區那組山門石梯統一成同一個
    // 60° 角度，不用兩邊各存一份不一樣的坡度數字。
    homeStoneStairs: {
      x: 33.5,
      z: 34,
      steps: 12,
      run: 0.58,
      dropPerStep: 0.58 * STAIR_SLOPE_TAN,
      width: DECORATIVE_STAIR_WIDTH,
    },
    foot: { x: 4, z: 49, width: 27, depth: 19, elevation: 0 },
    // 山之洞入口(2026-08-25，2026-08-25 二次調整往上收 5 格+縮小
    // 岩堆)——原本整組(x=10~19,z=49~54)貼在山腳平台(foot)最北緣，
    // 玩家反饋「視覺占比有點太大」，整組往上(z 變小)移 5 格到
    // z=44~49，落進 waist(z 到 43 為止)跟 foot(z 從 49 開始)中間
    // 那段沒有被 path()/plazas 畫到的空隙——這段空隙預設就是
    // tile=1(擋路)，平常由背景山壁(cliffMat)那片視覺蓋著，把洞口
    // 搬進來等於「岩堆順勢埋進既有山壁裡，只有拱門口洞露出來」，
    // 不用額外處理高度：mountainGroundY() 對這段空隙一樣回傳 0
    // (沒有落在 waist/summit/樓梯的判斷範圍內)，跟 foot 同一個
    // 基準，道具不用另外墊高。同時把 width 從 10 收到 6(x=12~17，
    // entranceX=14~15 保持置中，兩側各留 2 格岩塊緩衝，不是原本的
    // 4 格)——fillRows/rockCount 兩個岩堆迴圈(props.ts 的
    // makeCaveRockEntrance())都是依 cave.width 算範圍，縮小這個
    // 數字岩堆自動跟著變小變密，不用改渲染函式本身。depth 維持 6、
    // entranceStartZ 維持「cave.z+3」這個相對關係(=47)。
    cave: {
      x: 12,
      z: 44,
      width: 6,
      depth: 6,
      entranceX: 14,
      entranceWidth: 2,
      entranceStartZ: 47,
    },
    waist: { x: 7, z: 26, width: 27, depth: 18, elevation: 3.2 },
    summit: { x: 11, z: 3, width: 19, depth: 16, elevation: 6.5 },
    // 長方形觀景台，南緣(z=summitLookout.z+depth-1=2)直接跟山頂平台北緣
    // (summit.z-1=2)相接、不留缺口；右緣固定到 x=27(=x+width-1)。跟
    // summit/waist/foot 同一種 {x,z,width,depth} 矩形寫法，中心點/半徑
    // 一律在用到的地方現算(見 mountainGroundY()、addPlatform 的
    // isTransferOpening)，不要另外存一份 centerX/joinZ 分開維護。
    summitLookout: { x: 16, z: 0, width: 12, depth: 3 },
    lowerStair: {
      x: 21,
      width: 3,
      fromZ: 42,
      toZ: 51,
      baseElevation: 0,
      elevation: 3.2,
      steps: 14,
    },
    // X 對齊山腳→山腰的 lowerStair(x=21)，兩段樓梯疊成同一直線走廊，
    // 不再是左右交錯的之字形。isStairJoin()/mountainGroundY() 等全部
    // 從這個值算開口/高度，改這裡就會自動連動；只有下面兩條
    // path() 的寬度是為了舊 x=12 手調的魔術數字，得跟著重新推導，
    // 不然新位置下寬度會蓋出地圖邊界。
    upperStair: {
      x: 21,
      width: 3,
      fromZ: 17,
      toZ: 28,
      baseElevation: 3.2,
      elevation: 3.3,
      steps: 16,
    },
    treeDensity: 0.42,
    plazas: {
      summit: [
        { x: 15, z: 7, width: 11, depth: 7 },
        { x: 13, z: 9, width: 15, depth: 3 },
      ],
      waist: [
        { x: 14, z: 31, width: 14, depth: 8 },
        { x: 11, z: 34, width: 20, depth: 3 },
        { x: 18, z: 29, width: 10, depth: 12 },
      ],
      foot: [
        { x: 10, z: 54, width: 14, depth: 9 },
        { x: 8, z: 57, width: 19, depth: 4 },
        { x: 14, z: 52, width: 9, depth: 13 },
      ],
    },
    trees: [
      [27, 56],
      [9, 57],
      [18, 63],
      [24, 52],
      [10, 31],
      [16, 29],
      [27, 31],
      [32, 38],
      [18, 39],
      [25, 37],
      [14, 8],
      [18, 6],
      [27, 11],
      [27, 14],
    ],
  },
  mountainCave: {
    skyPalaceGate: { x: 43, z: 2, width: 3, depth: 3 },
    skyPalaceArrival: { x: 42, z: 3 },
  },
  skyPalace: {
    width: 50,
    height: 50,
    caveGate: { x: 23, z: 2, width: 3, depth: 3 },
    caveArrival: { x: 24, z: 5 },
    mountainGate: {
      trigger: { x: 24, z: 47 },
      arrival: { x: 24, z: 46 },
    },
  },
  port: {
    width: 34,
    // 南沙灘深度從 10 擴到 30(southBeach.depth)，height 對應加 10 到 60
    // 才裝得下(oceanExpansion 的最後 10 排維持不變，仍是最南側保底外海)。
    height: 60,
    oceanExpansion: 10,
    oceanViewPadding: 50,
    beachDepth: 10,
    elevation: 1,
    stairs: { x: 4, z: 8, width: 9, depth: 3 },
    livingGate: { x: 0, z: 0, width: 14 },
    oldVillageGate: {
      x: 0,
      z: 4,
      height: 44,
      beachStartZ: 30,
      beachEndZ: 47,
    },
    playerArrival: { x: 7, z: 11 },
    carpenterMeet: { x: 3, z: 21, width: 3, height: 3 },
    townGate: { x: 3, z: 29 },
    prologueGuide: {
      start: { x: 4, z: 22 },
      exit: { x: 0, z: 22 },
    },
    shopRoad: { z: 14, height: 5 },
    basin: { x: 6, z: 18, width: 15, height: 9 },
    eastOceanCutout: { x: 23, z: 11, height: 6 },
    // 2026-08-26：Zeppelin 反饋登陸艇畫面要往左(靠碼頭方向)移，先改
    // 13→11，同一天再要求多移一格，11→10。跳板長度會跟著這個常數
    // 自動變短，不用手動改 makePortScene() 那邊的算式。
    ferry: { x: 10, z: 22 },
    southQuay: { x: 0, z: 27, width: 24, height: 3 },
    southBeach: { x: 0, z: 30, width: 24, depth: 30 },
    southBeachStairs: { x: 7, z: 29, width: 7, depth: 3 },

    // 小燈塔位於防波堤通行格(x=21)右側海緣，玩家仍能走到塔旁。
    lighthouse: { x: 22.4, z: 28, scale: 1, collisionRadius: 0.58 },
    shops: [
      { x: 9, z: 12, w: 3, d: 2, seed: 0.22 },
      { x: 13, z: 12, w: 4, d: 2, seed: 0.47 },
      { x: 18, z: 12, w: 3, d: 2, seed: 0.73 },
    ],
  },
};
export const REST_CHAIR = {
  x: LAYOUT.restArea.x + LAYOUT.restArea.chair.offsetX,
  z: LAYOUT.restArea.z + LAYOUT.restArea.chair.offsetZ,
  rotation: LAYOUT.restArea.chair.rotation,
  playerRotation: LAYOUT.restArea.chair.playerRotation,
};

function makeMountainMapTiles() {
  const mountain = LAYOUT.mountain;
  const tiles = Array.from({ length: mountain.height }, () =>
    Array(mountain.width).fill(1),
  );
  const paint = (x, z, width, depth, tile = 0) => {
    for (let dz = z; dz < z + depth; dz++)
      for (let dx = x; dx < x + width; dx++)
        if (tiles[dz]?.[dx] !== undefined) tiles[dz][dx] = tile;
  };
  const path = (x, z, width, depth) => paint(x, z, width, depth, 5);
  paint(
    mountain.foot.x,
    mountain.foot.z,
    mountain.foot.width,
    mountain.foot.depth,
  );
  paint(
    mountain.waist.x,
    mountain.waist.z,
    mountain.waist.width,
    mountain.waist.depth,
  );
  paint(
    mountain.summit.x,
    mountain.summit.z,
    mountain.summit.width,
    mountain.summit.depth,
  );
  paint(
    mountain.summitLookout.x,
    mountain.summitLookout.z,
    mountain.summitLookout.width,
    mountain.summitLookout.depth,
  );
  // 新入口(22,67)幾乎跟 lowerStair(x=21) 同一條 x 上，不像舊入口(x=5)
  // 那樣需要先往東橫越大半個山腳平台——直接鋪一條連到樓梯基座的
  // 直向步道即可，寬度沿用 lowerStair.width 讓入口本身落在步道範圍內。
  path(
    mountain.lowerStair.x,
    mountain.foot.z + 8,
    mountain.lowerStair.width,
    mountain.townGate.z - (mountain.foot.z + 8) + 1,
  );
  path(mountain.lowerStair.x, mountain.foot.z + 2, 3, 6);
  path(
    mountain.lowerStair.x,
    mountain.lowerStair.fromZ,
    mountain.lowerStair.width,
    mountain.lowerStair.toZ - mountain.lowerStair.fromZ + 1,
  );
  // 山腰的路往右繞過賞櫻平台，再折回左側的第二段階梯。
  path(mountain.lowerStair.x, mountain.waist.z + 14, 10, 3);
  path(mountain.waist.x + mountain.waist.width - 6, mountain.waist.z + 7, 3, 9);
  // 寬度算到 waist.x+width-6(=下面那條垂直連接路的 x)右側再多蓋 1 格，
  // 兩條路才會確實重疊銜接；改用 upperStair.x 現算，不寫死舊位置(x=12)
  // 才會用到的魔術數字 18，不然樓梯搬到 x=21 後這條路會蓋出 waist 右邊界。
  path(
    mountain.upperStair.x,
    mountain.waist.z + 6,
    mountain.waist.x + mountain.waist.width - 4 - mountain.upperStair.x,
    3,
  );
  path(mountain.upperStair.x, mountain.waist.z, 3, 9);
  path(
    mountain.upperStair.x,
    mountain.upperStair.fromZ,
    mountain.upperStair.width,
    mountain.upperStair.toZ - mountain.upperStair.fromZ + 1,
  );
  // 第三階直接抵達山頂，但山頂步道仍有一次轉折才到觀景中心。寬度算到
  // summit.x+9+7(=下面那條 7 格寬廣場路的右緣)，跟上面一樣改用
  // upperStair.x 現算，不寫死舊位置(x=12)才對得上的魔術數字 11。
  path(
    mountain.upperStair.x,
    mountain.summit.z + mountain.summit.depth - 5,
    mountain.summit.x + 16 - mountain.upperStair.x,
    3,
  );
  path(mountain.summit.x + 9, mountain.summit.z + 5, 3, 8);
  path(mountain.summit.x + 9, mountain.summit.z + 4, 7, 3);
  // 山頂步道再往北延伸到觀景台矩形範圍內，路面本身接進去，不是
  // 走到山頂平台北緣就斷掉、剩觀景台那片地孤立在外。
  {
    const lookoutPathX =
      mountain.summitLookout.x +
      Math.floor((mountain.summitLookout.width - 1) / 2) -
      1;
    path(
      lookoutPathX,
      mountain.summitLookout.z + mountain.summitLookout.depth - 1,
      3,
      mountain.summit.z +
        4 -
        (mountain.summitLookout.z + mountain.summitLookout.depth - 1),
    );
  }
  Object.values(mountain.plazas).forEach((plazaParts) =>
    plazaParts.forEach((part) => path(part.x, part.z, part.width, part.depth)),
  );
  const protectedClearings = [
    {
      x: mountain.foot.x + Math.floor(mountain.foot.width / 2),
      z: mountain.foot.z + Math.floor(mountain.foot.depth / 2),
      radius: 4,
    },
    {
      x: mountain.summit.x + Math.floor(mountain.summit.width / 2),
      z: mountain.summit.z + Math.floor(mountain.summit.depth / 2),
      radius: 4,
    },
    {
      x: mountain.summitLookout.x + (mountain.summitLookout.width - 1) / 2,
      z: mountain.summitLookout.z + (mountain.summitLookout.depth - 1) / 2 + 1,
      radius:
        Math.hypot(
          mountain.summitLookout.width / 2,
          mountain.summitLookout.depth / 2,
        ) + 2,
    },
    { x: mountain.homeArrival.x, z: mountain.homeArrival.z, radius: 4.5 },
    {
      x: mountain.skyPalaceGate.trigger.x,
      z: mountain.skyPalaceGate.trigger.z,
      radius: 2,
    },
  ];
  for (let z = 0; z < mountain.height; z++) {
    for (let x = 0; x < mountain.width; x++) {
      if (tiles[z][x] !== 0) continue;
      if (
        protectedClearings.some(
          (clearing) =>
            Math.hypot(x - clearing.x, z - clearing.z) <= clearing.radius,
        )
      )
        continue;
      if (hash2(x * 5.17 + 12.3, z * 7.31 + 4.9) < mountain.treeDensity)
        tiles[z][x] = 2;
    }
  }
  for (let i = -1; i <= 1; i++)
    tiles[mountain.townGate.z][mountain.townGate.x + i] = 3;
  for (let i = -1; i <= 1; i++)
    tiles[mountain.homeGate.z + i][mountain.homeGate.x] = 3;
  tiles[mountain.skyPalaceGate.trigger.z][mountain.skyPalaceGate.trigger.x] = 3;
  mountain.trees.forEach(([x, z]) => {
    const insideClearing = protectedClearings.some(
      (clearing) =>
        Math.hypot(x - clearing.x, z - clearing.z) <= clearing.radius,
    );
    if (tiles[z]?.[x] === 0 && !insideClearing) tiles[z][x] = 2;
  });
  // 山之洞入口鏤空——放在樹木灑點/手動樹木清單之後，確保入口跟
  // 岩塊範圍一定淨空，不會被隨機或手動的樹覆蓋掉(不需要另外登記
  // protectedClearings，這裡是最後一步、無條件覆寫)。實心岩塊段
  // 用 tile=1(擋路，跟其他地圖的牆同一個值)；入口走廊段用 tile=0
  // (跟平台本身的草地同一個值——不是舊城鎮鐘乳石洞窟那邊沿用的
  // 沙灘 tile=8，那裡是因為周圍本來就是沙灘，這裡周圍是草地，走廊
  // 要跟著環境走)。外觀岩堆由 props.ts 的 makeMountainCaveEntrance()
  // 另外疊上去，這裡只負責碰撞用的 tile 值。
  {
    const cave = mountain.cave;
    for (let z = cave.z; z < cave.z + cave.depth - 1; z++)
      for (let x = cave.x; x < cave.x + cave.width; x++)
        if (tiles[z]?.[x] !== undefined) tiles[z][x] = 1;
    for (let z = cave.entranceStartZ; z < cave.z + cave.depth; z++)
      for (let x = cave.entranceX; x < cave.entranceX + cave.entranceWidth; x++)
        if (tiles[z]?.[x] !== undefined) tiles[z][x] = 0;
  }
  return tiles;
}

function makeSkyPalaceTiles() {
  const palace = LAYOUT.skyPalace;
  const tiles: number[][] = Array.from({ length: palace.height }, (_, z) =>
    Array.from({ length: palace.width }, (_, x) =>
      x === 0 || z === 0 || x === palace.width - 1 || z === palace.height - 1
        ? 1
        : 0,
    ),
  );
  for (let z = palace.caveGate.z; z < palace.caveGate.z + palace.caveGate.depth; z++)
    for (let x = palace.caveGate.x; x < palace.caveGate.x + palace.caveGate.width; x++)
      tiles[z][x] = 3;
  tiles[palace.mountainGate.trigger.z][palace.mountainGate.trigger.x] = 3;
  return tiles;
}

export function mountainGroundY(x: number, z: number) {
  const mountain = LAYOUT.mountain;
  const stairHeight = (stair) => {
    if (
      x < stair.x - 0.5 ||
      x > stair.x + stair.width - 0.5 ||
      z < stair.fromZ ||
      z > stair.toZ
    )
      return null;
    const stepDepth = (stair.toZ - stair.fromZ) / stair.steps;
    const stepIndex = Math.max(
      0,
      Math.min(stair.steps, Math.floor((stair.toZ - z) / stepDepth + 1e-6) + 1),
    );
    return stair.baseElevation + stepIndex * (stair.elevation / stair.steps);
  };
  for (const stair of [mountain.lowerStair, mountain.upperStair]) {
    const height = stairHeight(stair);
    if (height !== null) return height;
  }
  if (
    x >= mountain.summitLookout.x - 0.5 &&
    x <= mountain.summitLookout.x + mountain.summitLookout.width - 0.5 &&
    z >= mountain.summitLookout.z - 0.5 &&
    z <= mountain.summitLookout.z + mountain.summitLookout.depth - 0.5
  )
    return mountain.summit.elevation;
  if (
    x >= mountain.summit.x - 0.5 &&
    x <= mountain.summit.x + mountain.summit.width - 0.5 &&
    z >= mountain.summit.z - 0.5 &&
    z <= mountain.summit.z + mountain.summit.depth - 0.5
  )
    return mountain.summit.elevation;
  if (
    x >= mountain.waist.x - 0.5 &&
    x <= mountain.waist.x + mountain.waist.width - 0.5 &&
    z >= mountain.waist.z - 0.5 &&
    z <= mountain.waist.z + mountain.waist.depth - 0.5
  )
    return mountain.waist.elevation;
  return 0;
}

export function isOnMountainStair(x: number, z: number) {
  const mountain = LAYOUT.mountain;
  return [mountain.lowerStair, mountain.upperStair].some(
    (stair) =>
      x >= stair.x - 0.5 &&
      x <= stair.x + stair.width - 0.5 &&
      z >= stair.fromZ &&
      z <= stair.toZ,
  );
}

export function portGroundY(x: number, z: number) {
  const port = LAYOUT.port;
  const stairs = port.stairs;
  const southStairs = port.southBeachStairs;
  if (x >= -0.5 && x <= 2.5 && z >= -0.5 && z <= 0.5) return port.elevation;
  if (z > 0.5 && z < 8 && x < 2.5) return port.elevation;
  if (z >= 8 && z <= 11.5 && x < 2.5) return port.elevation;
  const stairRow = Math.floor(z - stairs.z + 0.5);
  const extendsLeft = stairRow >= 0 && stairRow < stairs.depth;
  const onStairs =
    x >= stairs.x - (extendsLeft ? 1.5 : 0.5) &&
    x <= stairs.x + stairs.width - 0.5 &&
    z >= stairs.z - 0.5 &&
    z <= stairs.z + stairs.depth - 0.5;
  if (onStairs) {
    return Math.max(
      0,
      Math.min(
        port.elevation,
        ((z - stairs.z + 1) / stairs.depth) * port.elevation,
      ),
    );
  }
  const onSouthStairs =
    x >= southStairs.x - 0.5 &&
    x <= southStairs.x + southStairs.width - 0.5 &&
    z >= southStairs.z - 0.5 &&
    z <= southStairs.z + southStairs.depth - 0.5;
  if (onSouthStairs) {
    return Math.max(
      0,
      Math.min(
        port.elevation,
        ((southStairs.z + southStairs.depth - z) / southStairs.depth) *
          port.elevation,
      ),
    );
  }
  const southBeach = port.southBeach;
  if (
    x >= southBeach.x - 0.5 &&
    x <= southBeach.x + southBeach.width - 0.5 &&
    z >= southBeach.z - 0.5 &&
    z <= portSouthBeachEndZ(Math.round(x)) + 0.5
  )
    return 0;
  return z >= port.beachDepth + 0.5 ? port.elevation : 0;
}

// 南沙灘的海岸線以 x 為種子產生穩定的小幅凹凸。地圖、碰撞與水面
// 都呼叫這個函式，避免沙格已經彎曲但水面仍維持一條直線。
export function portSouthBeachEndZ(x: number) {
  const beach = LAYOUT.port.southBeach;
  // depth 從 10 擴到 30 之後，鋸齒振幅也跟著放大(1.05/1.1→2.6/2.8，
  // 夾值±1→±4)，海岸線在更大範圍裡才看得出明顯凹凸，不會看起來只是
  // 一條位移過的直線。基準點抓在 beach.z+14(大約整段 30 深的中段偏
  // 前)，讓沙灘中段夠寬、海岸線抖動之後仍離地圖最南緣(height-1)有
  // 十幾格保底外海，不用再另外夾 Math.min——之前用 height-2 夾的
  // 版本，數值剛好落在公式自然範圍之內，反而把抖動整個吃掉，變成
  // 一條死板的直線（已在 map-debug 實測踩到這個坑）。
  const wave = Math.sin((x + 1.5) * 0.72) * 2.6;
  const noise = (hash2(x * 1.91, 73.4) - 0.5) * 2.8;
  const offset = Math.max(-4, Math.min(4, Math.round(wave + noise)));
  return beach.z + 14 + offset;
}

export function oldVillageGroundY(x: number, z: number) {
  const village = LAYOUT.oldVillage;
  const landing = village.mountainLanding;
  if (
    x >= landing.x - 0.5 &&
    x <= landing.x + landing.width - 0.5 &&
    z >= landing.z - 0.5 &&
    z <= landing.z + landing.depth
  )
    return landing.elevation;
  const westStair = village.westStairs.find(
    (candidate) =>
      x >= candidate.x - 0.5 &&
      x <= candidate.x + candidate.width - 0.5 &&
      z >= candidate.fromZ &&
      z <= candidate.toZ,
  );
  if (westStair) {
    const progress = Math.max(
      0,
      Math.min(1, (westStair.toZ - z) / (westStair.toZ - westStair.fromZ)),
    );
    return (
      westStair.baseElevation +
      Math.ceil(progress * westStair.steps - Number.EPSILON) *
        (westStair.elevation / westStair.steps)
    );
  }
  const platformBounds = oldVillageNorthPlatformBounds(Math.round(z));
  if (
    platformBounds &&
    x >= platformBounds.minX - 0.5 &&
    x <= platformBounds.maxX + 0.5
  )
    return village.northBeachPlatform.elevation;
  const stair = village.plazaStairs.find(
    (entry) =>
      z >= entry.z - 0.5 &&
      z <= entry.z + entry.width - 0.5 &&
      x >= entry.fromX - 0.5 &&
      x <= entry.toX + 0.5,
  );
  if (stair) {
    const progress = Math.max(
      0,
      Math.min(1, (stair.toX - x) / (stair.toX - stair.fromX)),
    );
    return (
      (stair.baseElevation || 0) +
      Math.ceil(progress * stair.steps - Number.EPSILON) *
        (stair.elevation / stair.steps)
    );
  }
  // 南側新擴充區：沙灘/海固定海平面(0)，跟 makeSand()/水面貼圖寫死的
  // 假設一致。這個判斷要放在下面的 x>westEdge 判斷之前——westEdge 是
  // 舊城鎮原本範圍(z0~29)才有意義的規則，z>=30 的新區域不該被它攔截。
  // 不能帶 -0.5 容許值：南側樓梯(westStairs 最後一段)fromZ 剛好等於
  // southBeach.z(30)，容許值會讓 z=29.5~29.99 落進這個分支提早跌到
  // 海平面(0)，跟樓梯銜接處的地面高度(groundElevation=1)產生一階落差，
  // 玩家會被 canTraverseVillageHeight() 的高度差門檻卡在樓梯正前方，
  // 連樓梯本身都還沒走到就過不去。
  if (z >= village.southBeach.z) return 0;
  // 西側新沙灘：同一套固定海平面(0)道理，跟南側沙灘那段共用同一個
  // 早退邏輯順序(放在樓梯判斷之後、westEdge/terraces 判斷之前)。
  // 不用 -0.5 容許值，因為西邊第一段樓梯緊接在 x=village.westBeach
  // .width(30)之後，跟南側樓梯緊接 southBeach.z 是同一種邊界寫法。
  if (x < village.westBeach.x + village.westBeach.width) return 0;
  // 廣場/南側預設地面墊高跟 middle 台地同高(groundElevation)，整個
  // 城鎮除了沙灘都在同一個抬高的地基上，才會有「平台」的觀感——這也是
  // middle.elevation 現在剛好等於 groundElevation 的原因，兩者本來就
  // 該是同一塊地基，不是巧合。
  if (x > village.terraces.westEdge) return village.groundElevation;
  if (z <= village.terraces.upper.maxZ) return village.terraces.upper.elevation;
  if (z >= village.terraces.middle.minZ && z <= village.terraces.middle.maxZ)
    return village.terraces.middle.elevation;
  return village.groundElevation;
}

export function oldVillageNorthPlatformBounds(z: number) {
  const village = LAYOUT.oldVillage;
  const platform = village.northBeachPlatform;
  const segments = platform.segments.filter(
    (entry) => z >= entry.z && z < entry.z + entry.depth,
  );
  if (segments.length === 0) return null;
  return {
    minX: Math.min(...segments.map((segment) => segment.x)),
    maxX: Math.max(...segments.map((segment) => segment.x + segment.width - 1)),
  };
}
// 南沙灘海岸線以 x 為種子產生穩定的鋸齒凹凸，跟 portSouthBeachEndZ()
// 同一套公式——地圖、碰撞與水面都呼叫這個函式，沙格彎曲時水面才會
// 跟著彎，不會沙灘已經凹凸不平、水面還是一條直線。
export function oldVillageSouthBeachEndZ(x: number) {
  const beach = LAYOUT.oldVillage.southBeach;
  // 基準點跟 portSouthBeachEndZ() 同一個相對位置(beach.z+14，depth=30
  // 的中段偏前)，兩邊沙灘深度現在都是 30，海岸線的比例才會一致。
  const wave = Math.sin((x + 2.3) * 0.58) * 2.6;
  const noise = (hash2(x * 1.73, 88.1) - 0.5) * 2.8;
  const offset = Math.max(-4, Math.min(4, Math.round(wave + noise)));
  return Math.min(LAYOUT.oldVillage.height - 2, beach.z + 14 + offset);
}

// 西沙灘岸線以 z 為種子產生鋸齒凹凸，跟 oldVillageSouthBeachEndZ()
// 同一套公式，只是方向轉 90 度：沙灘貼著城鎮那一側(x 較大、靠近
// village.westBeach.width)、外海在地圖真正邊界(x=0)那一側——跟南側
// 沙灘「貼著城鎮的 z 較小那側」是同一個相對關係(近城鎮=沙、遠城鎮=
// 海)。種子用不同的第二參數(46.7 而非 88.1)，避免兩段海岸線長得
// 一模一樣。回傳值是「沙灘覆蓋到哪個 x」，沙灘實際範圍是
// [回傳值, westBeach.width-1]，再往西(更小的 x)都是海。
export function oldVillageWestBeachStartX(z: number) {
  const beach = LAYOUT.oldVillage.westBeach;
  const wave = Math.sin((z + 2.3) * 0.58) * 2.6;
  const noise = (hash2(z * 1.73, 46.7) - 0.5) * 2.8;
  const offset = Math.max(-4, Math.min(4, Math.round(wave + noise)));
  const townEdgeX = beach.x + beach.width - 1;
  const generatedStartX = Math.max(beach.x + 1, townEdgeX - 14 + offset);
  // z=37 的沙舌由原本 x=12 一路向左延伸到地圖邊界 x=0。
  return z === 37 ? beach.x : generatedStartX;
}

/** 西南刪除區每列海水向東延伸到哪一格；核心範圍外再做不規則岸線。 */
export function oldVillageSouthwestSeaEndX(z: number) {
  const sea = LAYOUT.oldVillage.southwestSeaCutout;
  // z=38~45 之間以 smoothstep 從 x=16 漸進擴到 x=29，不在 z=45
  // 突然跳出一個直角。外緣再疊低頻波動，讓 (19~31,44) 一帶自然凹凸。
  const progress = Math.max(
    0,
    Math.min(1, (z - sea.z) / (sea.deepStartZ - sea.z)),
  );
  const smooth = progress * progress * (3 - 2 * progress);
  const coreEndX = Math.round(
    sea.upperCoreEndX + (sea.deepCoreEndX - sea.upperCoreEndX) * smooth,
  );
  const extra = Math.max(
    0,
    Math.min(3, Math.round(1.5 + Math.sin((z + 2.4) * 0.83) * 1.5)),
  );
  return coreEndX + extra;
}

export function isOnOldVillageStair(x: number, z: number) {
  const village = LAYOUT.oldVillage;
  const landing = village.mountainLanding;
  return (
    (x >= landing.x - 0.5 &&
      x <= landing.x + landing.width - 0.5 &&
      z >= landing.z - 0.5 &&
      z <= landing.z + landing.depth) ||
    village.westStairs.some(
      (stair) =>
        x >= stair.x - 0.5 &&
        x <= stair.x + stair.width - 0.5 &&
        z >= stair.fromZ &&
        z <= stair.toZ,
    ) ||
    village.plazaStairs.some(
      (stair) =>
        z >= stair.z - 0.5 &&
        z <= stair.z + stair.width - 0.5 &&
        x >= stair.fromX &&
        x <= stair.toX,
    )
  );
}

// 城鎮露台與樓梯的防墜扶手。線段同時供視覺與碰撞使用；樓梯口刻意
// 留空，只封住能直接跨越高低差的邊緣。
function makeNorthBeachPlatformRails() {
  const platform = LAYOUT.oldVillage.northBeachPlatform;
  const cells = new Set<string>();
  platform.segments.forEach((segment) => {
    for (let z = segment.z; z < segment.z + segment.depth; z++)
      for (let x = segment.x; x < segment.x + segment.width; x++)
        cells.add(`${x},${z}`);
  });
  const horizontal = new Map<number, number[]>();
  const vertical = new Map<number, number[]>();
  const add = (map: Map<number, number[]>, line: number, position: number) => {
    const positions = map.get(line) ?? [];
    positions.push(position);
    map.set(line, positions);
  };
  const stair = LAYOUT.oldVillage.westStairs.find(
    (entry) => entry.baseElevation === 0 && entry.elevation === platform.elevation,
  );
  cells.forEach((key) => {
    const [x, z] = key.split(',').map(Number);
    if (!cells.has(`${x},${z - 1}`)) add(horizontal, z - 0.5, x);
    if (
      !cells.has(`${x},${z + 1}`) &&
      !(stair && x >= stair.x && x < stair.x + stair.width)
    )
      add(horizontal, z + 0.5, x);
    if (!cells.has(`${x - 1},${z}`)) add(vertical, x - 0.5, z);
    if (!cells.has(`${x + 1},${z}`)) add(vertical, x + 0.5, z);
  });
  const rails: Array<{
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    elevation: number;
  }> = [];
  const mergeRuns = (
    entries: Map<number, number[]>,
    horizontalRun: boolean,
  ) => {
    entries.forEach((positions, line) => {
      const sorted = [...new Set(positions)].sort((a, b) => a - b);
      let start = sorted[0];
      let end = sorted[0];
      const emit = () =>
        rails.push(
          horizontalRun
            ? {
                x1: start - 0.5,
                z1: line,
                x2: end + 0.5,
                z2: line,
                elevation: platform.elevation,
              }
            : {
                x1: line,
                z1: start - 0.5,
                x2: line,
                z2: end + 0.5,
                elevation: platform.elevation,
              },
        );
      for (let index = 1; index < sorted.length; index++) {
        if (sorted[index] === end + 1) {
          end = sorted[index];
          continue;
        }
        emit();
        start = sorted[index];
        end = sorted[index];
      }
      emit();
    });
  };
  mergeRuns(horizontal, true);
  mergeRuns(vertical, false);
  return rails;
}

export const OLD_VILLAGE_RAILS: Array<{
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  elevation?: number;
}> = [
  {
    x1: 33,
    z1: 9.5,
    x2: 55,
    z2: 9.5,
    elevation: LAYOUT.oldVillage.terraces.upper.elevation,
  },
  {
    x1: 33,
    z1: 19.5,
    x2: 55,
    z2: 19.5,
    elevation: LAYOUT.oldVillage.terraces.middle.elevation,
  },
  {
    x1: LAYOUT.oldVillage.terraces.westEdge,
    z1: 0,
    x2: LAYOUT.oldVillage.terraces.westEdge,
    z2: 6.5,
  },
  {
    x1: LAYOUT.oldVillage.terraces.westEdge,
    z1: 10,
    x2: LAYOUT.oldVillage.terraces.westEdge,
    z2: 15.5,
  },
  // 西側與南側平台外緣。南側在兩座沙灘樓梯前分段，保留可走缺口。
  //
  // 2026-08-26：這條 x=29.5 的西緣扶手原本是單一一段 z:7~33，中間會
  // 穿過三段 westStairs(z2~7/z9~16/z19~26)，沒指定 elevation，逐點
  // 呼叫 oldVillageGroundY(29.5,z) 決定高度——樓梯範圍內剛好能查到對應
  // 階梯高度，看起來是刻意設計成「扶手跟著階梯一起爬升」。但三段樓梯
  // 之間的平台銜接處(z7~9、z16~19、z26~30)不在任何樓梯的 fromZ~toZ
  // 範圍內，會落到 oldVillageGroundY() 最前面「x < westBeach.width(30)
  // → 回傳 0(海平面)」那條早退判斷——x=29.5 剛好卡在西灘/城鎮的邊界
  // 上，這條判斷本來就沒開 -0.5 容許值(見該函式內註解，是為了南側同款
  // 判斷特意保留的精準邊界，不能改)。結果扶手在這三段銜接處會整段
  // 塌到海平面，Zeppelin 回報「扶手貼到外牆了」正是這個。
  //
  // 不改 oldVillageGroundY() 本體(牽動範圍太大)，改成在這裡把原本一
  // 整段拆開：樓梯範圍內維持原樣(不填 elevation，讓扶手繼續逐點跟著
  // 階梯爬升)，三段銜接處各自明確填對應台地高度(跟兩端階梯在該點算出
  // 來的高度一致，銜接處不會有高低差)。
  { x1: 29.5, z1: 7, x2: 29.5, z2: 9, elevation: LAYOUT.oldVillage.terraces.upper.elevation },
  { x1: 29.5, z1: 9, x2: 29.5, z2: 16 },
  { x1: 29.5, z1: 16, x2: 29.5, z2: 19, elevation: LAYOUT.oldVillage.terraces.middle.elevation },
  { x1: 29.5, z1: 19, x2: 29.5, z2: 26 },
  { x1: 29.5, z1: 26, x2: 29.5, z2: 30, elevation: LAYOUT.oldVillage.groundElevation },
  { x1: 29.5, z1: 30, x2: 29.5, z2: 33 },
  {
    x1: 32.5,
    z1: 29.5,
    x2: 57.5,
    z2: 29.5,
    elevation: LAYOUT.oldVillage.groundElevation,
  },
  {
    x1: 64.5,
    z1: 29.5,
    x2: 76,
    z2: 29.5,
    elevation: LAYOUT.oldVillage.groundElevation,
  },
  ...LAYOUT.oldVillage.plazaStairs.flatMap((stair) => [
    { x1: stair.fromX, z1: stair.z - 0.5, x2: stair.toX, z2: stair.z - 0.5 },
    {
      x1: stair.fromX,
      z1: stair.z + stair.width - 0.5,
      x2: stair.toX,
      z2: stair.z + stair.width - 0.5,
    },
  ]),
  ...LAYOUT.oldVillage.westStairs.flatMap((stair) => [
    // x=30 的樓梯左側已由連續的西側平台護欄涵蓋，避免重疊模型。
    ...(stair.x === 30 && stair.fromZ >= 7
      ? []
      : [
          {
            x1: stair.x - 0.5,
            z1: stair.fromZ,
            x2: stair.x - 0.5,
            z2: stair.toZ,
          },
        ]),
    {
      x1: stair.x + stair.width - 0.5,
      z1: stair.fromZ,
      x2: stair.x + stair.width - 0.5,
      z2: stair.toZ,
    },
  ]),
  ...makeNorthBeachPlatformRails(),
];

export function isBlockedByOldVillageRail(x: number, z: number) {
  const thickness = 0.18;
  return OLD_VILLAGE_RAILS.some((rail) =>
    rail.x1 === rail.x2
      ? Math.abs(x - rail.x1) <= thickness &&
        z >= Math.min(rail.z1, rail.z2) &&
        z <= Math.max(rail.z1, rail.z2)
      : Math.abs(z - rail.z1) <= thickness &&
        x >= Math.min(rail.x1, rail.x2) &&
        x <= Math.max(rail.x1, rail.x2),
  );
}

function makePortTiles() {
  const p = LAYOUT.port;
  const tiles = Array.from({ length: p.height }, () =>
    new Array(p.width).fill(0),
  );

  // 北緣是生活區沙灘的延續，直接使用相同的 tile 8 / makeSand() 管線。
  for (let z = 0; z < p.beachDepth; z++) {
    const startX = z < p.beachDepth - 2 ? 3 : 4;
    for (let x = startX; x < p.width; x++) tiles[z][x] = 8;
  }
  for (let x = 20; x < p.width; x++) tiles[p.beachDepth][x] = 8;

  // 原北東側 x=14~23 的沙灘改為海；新增的右側十格也延續成外海。
  for (let z = 0; z <= p.beachDepth; z++) {
    for (let x = 14; x < p.width; x++) tiles[z][x] = 9;
  }
  for (let z = 0; z < p.height; z++) {
    for (let x = p.width - p.oceanExpansion; x < p.width; x++) tiles[z][x] = 9;
  }
  for (let z = p.height - p.oceanExpansion; z < p.height; z++) {
    for (let x = 0; x < p.width; x++) tiles[z][x] = 9;
  }


  // 東側誤延伸的平台清回海面。範圍由 LAYOUT 持有，東擴新增欄會由
  // PORT_OCEAN_EXPANSION 直接填海，不需要在這裡寫最右 X 座標。
  for (
    let z = p.eastOceanCutout.z;
    z < p.eastOceanCutout.z + p.eastOceanCutout.height;
    z++
  ) {
    for (let x = p.eastOceanCutout.x; x < p.width; x++) tiles[z][x] = 9;
  }

  // 中央內港、右側航道與南側外海；石造碼頭保留在四周的 0 格。
  for (let z = p.basin.z; z < p.basin.z + p.basin.height; z++) {
    for (let x = p.basin.x; x < p.basin.x + p.basin.width; x++) tiles[z][x] = 9;
  }
  for (let z = p.basin.z - 1; z < p.height; z++) {
    for (let x = 21; x < p.width; x++) tiles[z][x] = 9;
  }
  for (let x = 4; x < p.width; x++) tiles[p.height - 1][x] = 9;

  // 南碼頭向東延伸到燈塔腳下。這段必須在航道填海之後覆寫，否則
  // x>=21 會被上面的航道迴圈重新變成海，視覺平台與碰撞便會分離。
  for (let z = p.southQuay.z; z < p.southQuay.z + p.southQuay.height; z++) {
    for (let x = p.southQuay.x; x < p.southQuay.x + p.southQuay.width; x++)
      tiles[z][x] = 0;
  }

  // 港口南側低地沙灘同樣在航道之後覆寫；寬度延伸到燈塔平台下方。
  // 最南一列仍由上面的外海保底覆寫維持為海。
  const southOceanFillEndZ = Math.min(
    p.height - 2,
    p.southBeach.z + p.southBeach.depth - 1,
  );
  for (let x = p.southBeach.x; x < p.southBeach.x + p.southBeach.width; x++) {
    for (let z = p.southBeach.z; z <= southOceanFillEndZ; z++) tiles[z][x] = 9;
    const shoreEndZ = portSouthBeachEndZ(x);
    for (let z = p.southBeach.z; z <= shoreEndZ; z++) tiles[z][x] = 8;
  }


  p.shops.forEach((shop) => {
    for (let z = shop.z; z < shop.z + shop.d; z++) {
      for (let x = shop.x; x < shop.x + shop.w; x++) tiles[z][x] = 1;
    }
  });
  for (let i = 0; i < p.livingGate.width; i++)
    tiles[p.livingGate.z][p.livingGate.x + i] = 3;
  return tiles;
}

function makeOldVillageTiles() {
  const village = LAYOUT.oldVillage;
  const tiles = Array.from({ length: village.height }, () =>
    new Array(village.width).fill(0),
  );
  const paint = (x, z, width, height, tile = 5) => {
    for (let dz = z; dz < z + height; dz++)
      for (let dx = x; dx < x + width; dx++) tiles[dz][dx] = tile;
  };

  // Cinque Terre-inspired hillside circulation: three terraces, narrow climbs,
  // and a broad civic space opening toward the old fishing port.
  // roadStartX：原本寫死 2(緊貼西側樓梯，刻意跟 westStairs 的 x=0~2
  // 最後一欄重疊一點，跟樓梯銜接不留縫)，西側新沙灘加入後改成從
  // westBeach 推導——城鎮乾地西緣(townWestX)再往東 2 格，維持跟樓梯
  // 同一種「差 2 格」關係，不是直接 +30 硬套，因為 terraceRoadWidth
  // 的公式本身也吃 westEdge(已經 +30)，兩邊都改才會維持原本的寬度。
  const roadStartX = village.westBeach.x + village.westBeach.width + 2;
  const terraceRoadWidth = Math.floor(
    village.terraces.westEdge + 0.5 - roadStartX,
  );
  paint(roadStartX, 7, terraceRoadWidth, 3);
  paint(roadStartX, 16, terraceRoadWidth, 3);
  paint(roadStartX, 26, terraceRoadWidth, 3);
  // 樓梯本身由橫向道路與廣場覆蓋；不再額外鋪一條直向土色平台，
  // 避免樓梯兩旁露出突兀的方形路皮。
  paint(
    village.plaza.x,
    village.plaza.z,
    village.plaza.width,
    village.plaza.height,
  );
  paint(village.livingGate.x, 0, village.livingGate.width, 5);
  paint(
    village.mountainLanding.x,
    village.mountainLanding.z,
    village.mountainLanding.width,
    8,
  );
  paint(
    village.westBeach.x + village.westBeach.width + 3,
    24,
    village.mountainRoad.width,
    6,
  );

  for (let x = 0; x < village.livingGate.width; x++)
    tiles[0][village.livingGate.x + x] = 3;
  for (let z = 0; z < village.portGate.height; z++)
    tiles[village.portGate.z + z][village.portGate.x] = 3;
  for (let i = -1; i <= 1; i++)
    tiles[village.mountainGate.z][village.mountainGate.x + i] = 3;
  village.houses.forEach((house) => {
    const width = house.w ?? 1;
    const depth = house.d ?? 1;
    for (let z = house.z; z < house.z + depth; z++) {
      for (let x = house.x; x < house.x + width; x++) tiles[z][x] = 1;
    }
  });
  // 南側新沙灘/海——跟港口南沙灘同一套「先鋪滿整段海，再依 x 算的
  // 鋸齒岸線疊蓋沙灘」寫法：沙灘凹凸不平，不是一條直線。
  const beach = village.southBeach;
  for (let x = beach.x; x < beach.x + beach.width; x++) {
    for (let z = beach.z; z < village.height; z++) tiles[z][x] = 9;
  }
  for (let x = beach.x; x < beach.x + beach.width; x++) {
    const shoreEndZ = oldVillageSouthBeachEndZ(x);
    for (let z = beach.z; z <= shoreEndZ; z++) tiles[z][x] = 8;
  }
  // 西側新沙灘/海——跟南側同一套「先鋪滿整段海，再疊鋸齒沙灘」寫法，
  // 只是沿 z 逐排、沙灘貼著城鎮那一側(x 較大)、海在地圖真正邊界
  // (x=0)那一側。z 用整張地圖的高度(village.height)，讓西沙灘一路
  // 延伸到最南端，跟南沙灘在西南角自然接上，不留一塊乾地夾在中間。
  const westBeach = village.westBeach;
  for (let z = 0; z < village.height; z++) {
    for (let x = westBeach.x; x < westBeach.x + westBeach.width; x++)
      tiles[z][x] = 9;
  }
  for (let z = 0; z < village.height; z++) {
    const shoreStartX = oldVillageWestBeachStartX(z);
    for (let x = shoreStartX; x < westBeach.x + westBeach.width; x++)
      tiles[z][x] = 8;
  }
  // 西南角切回外海：x=11~16 從 z=38 往南必定是海，z=45 起再保證
  // x=17~29 也是海；每列向東額外吃進 0~4 格，避免切口像直角方框。
  const seaCutout = village.southwestSeaCutout;
  for (let z = seaCutout.z; z < seaCutout.z + seaCutout.height; z++) {
    const seaEndX = oldVillageSouthwestSeaEndX(z);
    for (let x = seaCutout.x; x <= seaEndX; x++) tiles[z][x] = 9;
  }
  // 西北沙灘的山腳洞窟：山體格不可走，中央留兩格寬、三格深的假入口。
  // 目前只做視覺洞口，不觸發換圖；走到深處會由北側實心山壁擋住。
  const cave = village.stalactiteCave;
  for (let z = cave.z; z < cave.z + cave.depth - 1; z++)
    for (let x = cave.x; x < cave.x + cave.width; x++) tiles[z][x] = 1;
  for (let z = cave.entranceStartZ; z < cave.z + cave.depth; z++)
    for (let x = cave.entranceX; x < cave.entranceX + cave.entranceWidth; x++)
      tiles[z][x] = 8;
  // 沙灘生成會覆寫邊界格，因此最後重畫與港口相連的黃色門檻。
  // z=4~47 全部逐格連通，其中 z=30~47 是這次新增的沙灘通道。
  for (let z = 0; z < village.portGate.height; z++) {
    const worldZ = village.portGate.z + z;
    if (
      worldZ >= village.portGate.beachStartZ &&
      worldZ <= village.portGate.beachEndZ
    )
      tiles[worldZ][village.portGate.x - 1] = 8;
    tiles[worldZ][village.portGate.x] = 3;
  }
  return tiles;
}

export function lakeEdgeFactor(theta) {
  const centerX = LAYOUT.lake.x + (LAYOUT.lake.width - 1) / 2;
  const centerZ = LAYOUT.lake.z + (LAYOUT.lake.height - 1) / 2;
  const seed = hash2(centerX * 1.7, centerZ * 2.3) * 20;
  return (
    1 +
    0.2 * Math.sin(theta * 2 + seed) +
    0.12 * Math.sin(theta * 3 + seed * 1.6) +
    0.07 * Math.sin(theta * 5 + seed * 2.4)
  );
}

// 海岸線沙灘/海的分界不要是直線——每一排(z)算一個決定性的偏移量。故意
// 只疊兩個低頻正弦波、振幅也收斂到 2 格內：頻率太高、振幅太大會讓相鄰
// 排落差超過 1 格，邊界變成尖銳鋸齒，沿岸的浪花(makeFoam，一排一組)
// 也會因為忽左忽右而斷成一塊塊，不像連續的海岸線。只動沙灘/海的交界，
// 懸崖/沙灘那條邊維持筆直（那是碰撞用的山壁，搖它風險比較高）
export function coastShoreJitter(z) {
  return Math.round(
    1.3 * Math.sin(z * 0.15 + 3.1) + 0.7 * Math.sin(z * 0.42 + 9.4),
  );
}
// 視覺湖岸、碰撞與釣魚判定共用同一個不規則橢圓輪廓。
export function isInsideLakeShape(x, z, shoreInset = 0) {
  const centerX = LAYOUT.lake.x + (LAYOUT.lake.width - 1) / 2;
  const centerZ = LAYOUT.lake.z + (LAYOUT.lake.height - 1) / 2;
  const radiusX = LAYOUT.lake.width * 0.35 - shoreInset;
  const radiusZ = LAYOUT.lake.height * 0.35 - shoreInset;
  const nx = (x - centerX) / radiusX,
    nz = (z - centerZ) / radiusZ;
  const theta = Math.atan2(nz, nx);
  return Math.hypot(nx, nz) <= lakeEdgeFactor(theta);
}

// ==============================================================
// 1) 地圖資料 — 故意在村長「家→田」的路上多種一棵樹 (4,5)，
//    直線距離是最短路徑，但現在會被這棵樹擋住，逼 A* 繞路
// ==============================================================
export const MAPS = {
  livingArea: {
    tiles: [
      // 房子後面新開的一大塊地：z=0~6 是全新區域，穀倉搬過來這裡，
      // 牧場也在這，比舊的東側牧場大很多
      [2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      // 以下是原本的地圖，整段往下移了 7 格（z 全部 +7），內容本身沒變，
      // 只有舊穀倉的牆拆掉(1 改回 0)，因為穀倉搬到上面新區域去了
      [2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2],
      [0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 6, 6, 6, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2],
      [0, 6, 6, 6, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 2, 0, 5, 0, 0, 0, 0, 2, 0, 0],
      [0, 0, 7, 7, 7, 0, 5, 0, 0, 0, 0, 2, 0, 0],
      [0, 0, 7, 7, 7, 0, 5, 0, 0, 0, 0, 0, 2, 0],
      [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 2, 0, 0],
      [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0],
    ],
    buildings: [
      {
        x: LAYOUT.house.x,
        z: LAYOUT.house.z,
        w: LAYOUT.house.w,
        d: LAYOUT.house.d,
        doorX: LAYOUT.house.doorX,
        visualScale: LAYOUT.house.visualScale,
        doorWorldHeight: LAYOUT.house.doorWorldHeight,
      },
      {
        x: LAYOUT.barn.x,
        z: LAYOUT.barn.z,
        w: LAYOUT.barn.w,
        d: LAYOUT.barn.d,
        doorX: LAYOUT.barn.doorX,
        visualScale: LAYOUT.barn.visualScale,
        doorWorldHeight: LAYOUT.barn.doorWorldHeight,
        style: "barn",
      },
    ],
    playerStart: { x: 21, z: 16 + NORTH_EXPANSION },
  },
  // 2026-08-26 內部放大兩倍(8x7 → 16x14)，外部(這個檔案最前面那個
  // LAYOUT.house，w/d/doorX/visualScale)不動——玩家明確說「外部先不動」，
  // 只有這個內部房間的 tiles/windows/furniture/playerStart 換成新格局；
  // 對外的門口觸發座標(build-map.ts 的 events 陣列)、桌燈/頂燈擺放位置
  // 也一併跟著新家具座標搬過去了。
  house: {
    // 格局規劃：西北角隔出臥室(x1-6,z1-4，z=5 整排留空當走道銜接主空間，
    // 跟舊格局同一種「tiles 陣列裡多幾道牆」手法，不用另外寫房間概念)；
    // 西側 z=8-10 是廚房一角；主空間(x8-14 整段+東側)夠大，中央擺餐桌
    // 配四張椅子，之前只有兩張。門維持 2 格寬，搬到新格局最後一排置中。
    tiles: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1],
    ],
    // x=7、z=1~4 是臥室隔間牆，z=5 整排留空當走道(跟舊格局 z=3 那道
    // 缺口同一招)，圍出西北角一間 6x4 的臥室，跟主空間分開。
    windows: [
      { x: 3, z: 0, side: "north" }, // 臥室窗
      { x: 11, z: 0, side: "north" }, // 主空間窗(餐廳上方)
      { x: 0, z: 9, side: "west" }, // 廚房窗
      { x: 15, z: 3, side: "east" },
      { x: 15, z: 9, side: "east" },
    ],
    // 家具是獨立於 tiles 的資料層，跟 livingArea 的 buildings 同一套邏輯：
    // tiles 只負責「牆在哪」，家具在哪、佔幾格、擋不擋路是這裡另外定義
    furniture: [
      { type: "bed", x: 2, z: 1, w: 1, d: 2 },
      { type: "rug", x: 4, z: 3, nonBlocking: true }, // 臥室地毯
      // 北牆完整廚房：冰箱接五格櫥櫃；stove 仍是正式料理互動點。
      { type: "fridge", x: 9, z: 1 },
      { type: "counter", x: 10, z: 1, variant: "sink" },
      { type: "counter", x: 11, z: 1, variant: "prep" },
      { type: "stove", x: 12, z: 1 },
      { type: "counter", x: 13, z: 1, variant: "drawer" },
      { type: "counter", x: 14, z: 1, variant: "storage" },
      // 北牆上的關閉裝飾門；牆 tile 保留碰撞，未來再接衛浴地圖。
      { type: "bathroom-door", x: 8, z: 0, nonBlocking: true },
      // 主空間餐廳——房子變大了，餐桌從兩張椅子擴成四張，四面各一張，
      // 旋轉角度沿用舊格局「面向桌子」那組換算：南側 rot=PI、東側
      // rot=-PI/2，北側/西側對稱補上 rot=0／rot=PI/2。
      { type: "table", x: 11, z: 6 },
      { type: "chair", sittable: true, x: 11, z: 5, rot: 0 },
      { type: "chair", sittable: true, x: 11, z: 7, rot: Math.PI },
      { type: "chair", sittable: true, x: 12, z: 6, rot: -Math.PI / 2 },
      { type: "chair", sittable: true, x: 10, z: 6, rot: Math.PI / 2 },
      { type: "rug", x: 9, z: 6, nonBlocking: true }, // 餐廳地毯
    ],
    playerStart: { x: 8, z: 12 },
  },
  // 雜貨店室內——2026-09-03 Zeppelin 要求「先把主角家地圖複製一份就過去
  // 就好」，這裡跟 mountainCave 複製 stalactiteCave 佔位房間同一個做法，
  // tiles/windows 照抄 MAPS.house(16x14)。牆體/窗戶/南牆可見度共用 house
  // 那一支渲染分支(見 build-map.ts 的 mapName === "house" 那幾處已經一併
  // 加上 "generalStore")，INDOOR_MAPS(environment.ts)也加了這張圖。
  // 2026-09-03 第二輪反饋：把原本照抄 house 的臥室隔間拿掉(改成
  // 「左邊雜貨店、右邊休憩區兼接待中心」)——隔間牆只有 x=7,z=1~4 這四格
  // (z=5 那排本來就沒牆，是原本 house 臥室走道的開口)，這裡拿掉那四格
  // 讓房間整個打通，z=5 那個原本就有的開口自然變成兩側之間依然通暢的
  // 「門」，不用另外標記。
  // 2026-09-03 第三輪反饋：Zeppelin 附了平面圖+概念圖參考，把西側
  // (x=1~7)雜貨店家具照那張圖的相對位置重排——貨架區沿西牆、收報台在
  // 北側偏中、冰箱在收報台右邊、展示桌在房間中段、倉庫用一扇裝飾門
  // 代表店主專用出入口(跟原本 house 那扇 bathroom-door 同一招，牆 tile
  // 本身仍是實牆，只是視覺上有扇門)。收報台(4,2)是 Zeppelin 之後要放
  // 村長站著賣東西的位置，先佔位，還沒接 NPC。可用的家具類型只有
  // counter/fridge/table/chair/rug/bathroom-door(見 props-decor.ts 的
  // makeFurniture)，沒有專門的「貨架/收銀機」模型，所以貨架跟收報台都
  // 借用 counter(storage 那個變體本身就是一對陶罐，視覺上最接近雜貨鋪)。
  // 東側(x=8~14)休憩區兼接待中心維持上一輪的餐桌椅+接待櫃台不動。
  generalStore: {
    tiles: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1, 1, 1, 1],
    ],
    windows: [
      { x: 3, z: 0, side: "north" }, // 雜貨店側
      { x: 11, z: 0, side: "north" }, // 休憩區側
      { x: 0, z: 9, side: "west" },
      { x: 15, z: 3, side: "east" },
      { x: 15, z: 9, side: "east" },
    ],
    furniture: [
      // 雜貨店(x=1~7)——照平面圖參考重排：
      // 倉庫(店主出入口)——裝飾門，代表店主專用的後台出入口，跟 house
      // 那扇 bathroom-door 一樣是牆上的裝飾，牆 tile(z=0 整排)本身還是
      // 實牆、不能真的走過去。
      { type: "bathroom-door", x: 1, z: 0, nonBlocking: true },
      // 貨架區(一般商品)——四座置物櫃台沿西牆排成一列。
      { type: "store-shelf", x: 1, z: 3 },
      { type: "store-shelf", x: 4, z: 1 },
      { type: "store-shelf", x: 5, z: 1 },
      { type: "store-shelf", x: 1, z: 5 },
      { type: "store-shelf", x: 1, z: 7 },
      { type: "store-shelf", x: 1, z: 9 },
      // 2026-09-03 第四輪反饋：Zeppelin 對照實際進遊戲的畫面調整——
      // 原本(4,2)那座佔位用的收報台拿掉，冰箱搬到房間右上角(7,1，
      // 緊貼隔間拆掉後空出來的東牆邊)，改用一排 L 形木櫃台
      // ((3,5)→(6,5)轉(6,5)→(6,1))當真正的收銀櫃台，店員站在 L 形
      // 內側。2026-09-03 第五輪反饋：L 形內側轉角(5,4)原本放的收銀機
      // 佔位台子也拿掉了——先空著，之後有專門的收銀機模型再放，
      // 不再借用 counter 湊。
      // 冰箱(冷藏商品)——房間右上角，緊貼隔間拆掉後空出來的東牆邊。
      { type: "display-fridge", x: 7, z: 1 },
      // L 形木櫃台——drawer 變體是素面木頭抽屜櫃(不像 storage 頂著兩罐
      // 陶罐)，讀起來比較像「可以站在後面工作的櫃台」而不是貨架。
      { type: "system-counter", x: 3, z: 5, w: 4, d: 1, variant: "register" },
      { type: "system-counter", x: 6, z: 1, w: 1, d: 4 },
      // 展示桌(特價品/活動)——房間中段，不配椅子，跟休憩區的餐桌區分開。
      { type: "table", x: 4, z: 8 },
      { type: "rug", x: 4, z: 9, nonBlocking: true },
      // 休憩區兼接待中心(x=8~14)——原餐桌椅原地保留當休憩座位，
      // 靠門口加一座櫃台當接待櫃台。
      { type: "table", x: 11, z: 6 },
      { type: "chair", sittable: true, x: 11, z: 5, rot: 0 },
      { type: "chair", sittable: true, x: 11, z: 7, rot: Math.PI },
      { type: "chair", sittable: true, x: 12, z: 6, rot: -Math.PI / 2 },
      { type: "chair", sittable: true, x: 10, z: 6, rot: Math.PI / 2 },
      { type: "rug", x: 9, z: 6, nonBlocking: true },
      { type: "counter", x: 12, z: 11, variant: "storage" },
    ],
    playerStart: { x: 8, z: 12 },
  },
  // 舊城鎮——目前只做骨架：一塊廣場空地＋幾間空屋佔位方塊(makeTownPlaceholder)，
  // 沒有木匠工坊內裝。playerStart 設在北側，之後往北接港口商業街入口。
  // 南側原本接美術村的兩個門檻已移除，改成南側新沙灘(見 LAYOUT.oldVillage
  // 的 westStairs 最後一段+southBeach)。
  oldVillage: {
    tiles: makeOldVillageTiles(),
    placeholders: LAYOUT.oldVillage.houses,
    playerStart: { x: LAYOUT.oldVillage.livingGate.x + 1, z: 2 },
  },
  mountain: {
    tiles: makeMountainMapTiles(),
    playerStart: { ...LAYOUT.mountain.townArrival },
  },
  skyPalace: {
    tiles: makeSkyPalaceTiles(),
    playerStart: { ...LAYOUT.skyPalace.caveArrival },
  },
  // 港口——左側石板廣場接舊城鎮；中央是三面石造碼頭包圍的內港與渡輪；
  // 北側商店背後的沙灘延續生活區；右側木棧橋停小艇。保留原本西界換圖、
  // 木匠事件(7,3)。南側沙灘深度擴充到 30(見 LAYOUT.port.southBeach)。
  port: {
    tiles: makePortTiles(),
    playerStart: { ...LAYOUT.port.playerArrival },
  },
  // 女神祠堂——生活區私人海岸沿著北側沙灘往北走到底的小平台，這輪
  // 只求「走得到、有地方站」，退潮限定的判定邏輯之後再接；先放一塊
  // 平台(沿用其他非 livingArea 地圖同一套平面地板)+一座鳥居佔位。
  shrine: {
    tiles: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 0, 0, 0],
    ],
    playerStart: { x: 4, z: 4 },
  },
  // 鐘乳石洞窟內部——先求「進得去、有地方站」的簡易版本，跟 shrine
  // 同等級：純平地小房間，沒有內裝/機關。門(3 格寬，x=3~5，跟洞口
  // entranceWidth 對齊)開在南牆，玩家從舊城鎮西北沙灘的洞口走進來，
  // 落在門正北一格；四周牆體用 tile=1 純擋路，視覺上的岩壁另外在
  // build-map.ts 用簡單方塊+吊石筍做，不用真的蓋房子牆模型。
  stalactiteCave: {
    tiles: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 3, 3, 3, 1, 1, 1],
    ],
    playerStart: { x: 4, z: 5 },
  },
  // 山之洞內部——先套用鐘乳石洞窟同一份「進得去、有地方站」佔位房間
  // 模板，一字不改；tiles/playerStart 進洞窟當下就會被
  // mine.ts 的 regenerateMountainMineFloor() 整個覆寫成當層 50x50
  // 的洞窟房間，這裡只是 loadMap() 第一次讀到 MAPS.mountainCave 時
  // 的保底佔位，跟 stalactiteCave 這格的角色完全一樣。
  mountainCave: {
    tiles: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 3, 3, 3, 1, 1, 1],
    ],
    playerStart: { x: 4, z: 5 },
  },
};

// 舊城鎮外海擴充：西側插入 100 欄海、南側追加 100 列海。
// 西擴會同步平移 LAYOUT、護欄、建築與玩家起點；南擴不改既有座標。
export const OLD_VILLAGE_OCEAN_EXPANSION = { west: 100, south: 100 };
shiftMapLayout({
  tiles: MAPS.oldVillage.tiles,
  direction: "west",
  amount: OLD_VILLAGE_OCEAN_EXPANSION.west,
  fillValue: 9,
  coordinateRoots: [LAYOUT.oldVillage, OLD_VILLAGE_RAILS],
  playerStart: MAPS.oldVillage.playerStart,
});
shiftMapLayout({
  tiles: MAPS.oldVillage.tiles,
  direction: "south",
  amount: OLD_VILLAGE_OCEAN_EXPANSION.south,
  fillValue: 9,
  coordinateRoots: [LAYOUT.oldVillage, OLD_VILLAGE_RAILS],
  playerStart: MAPS.oldVillage.playerStart,
});
LAYOUT.oldVillage.width = MAPS.oldVillage.tiles[0].length;
LAYOUT.oldVillage.height = MAPS.oldVillage.tiles.length;

// 西擴後才依最終 LAYOUT 座標鋪這塊沙灘，避免在原始 77 欄 tile grid
// 使用負索引。若日後調整外海寬度，範圍仍會跟著 shiftMapLayout 同步平移。
for (const sandPatch of [
  LAYOUT.oldVillage.northBeach,
  LAYOUT.oldVillage.northBeachEastFill,
]) {
  for (let z = sandPatch.z; z < sandPatch.z + sandPatch.height; z++) {
    for (let x = sandPatch.x; x < sandPatch.x + sandPatch.width; x++) {
      if (MAPS.oldVillage.tiles[z]?.[x] !== undefined)
        MAPS.oldVillage.tiles[z][x] = 8;
    }
  }
}
const northBeach = LAYOUT.oldVillage.northBeach;
const northBeachOuterFringe = LAYOUT.oldVillage.northBeachOuterFringe;
northBeachOuterFringe.northDepths.forEach((depth, index) => {
  const x = northBeach.x + index;
  for (let offset = 1; offset <= depth; offset++) {
    const z = northBeach.z - offset;
    if (MAPS.oldVillage.tiles[z]?.[x] !== undefined)
      MAPS.oldVillage.tiles[z][x] = 8;
  }
});
for (const [side, depths] of [
  [-1, northBeachOuterFringe.westDepths],
  [1, northBeachOuterFringe.eastDepths],
] as const) {
  depths.forEach((depth, index) => {
    const z = northBeach.z + index;
    for (let offset = 1; offset <= depth; offset++) {
      const x = side < 0
        ? northBeach.x - offset
        : northBeach.x + northBeach.width - 1 + offset;
      if (MAPS.oldVillage.tiles[z]?.[x] !== undefined)
        MAPS.oldVillage.tiles[z][x] = 8;
    }
  });
}
const northBeachEastShelf = LAYOUT.oldVillage.northBeachEastShelf;
northBeachEastShelf.northDepths.forEach((depth, index) => {
  const x = northBeachEastShelf.x + index;
  for (let z = northBeachEastShelf.z - depth + 1; z <= northBeachEastShelf.z; z++) {
    if (MAPS.oldVillage.tiles[z]?.[x] !== undefined)
      MAPS.oldVillage.tiles[z][x] = 8;
  }
});
const northBeachSouthEdge = LAYOUT.oldVillage.northBeachSouthEdge;
northBeachSouthEdge.endOffsets.forEach((offset, index) => {
  const x = northBeachSouthEdge.x + index;
  const endZ = northBeachSouthEdge.z + offset;
  for (let z = northBeachSouthEdge.z - 1; z <= northBeachSouthEdge.z + 1; z++)
    MAPS.oldVillage.tiles[z][x] = z <= endZ ? 8 : 9;
});
const northBeachEastSeaCutout = LAYOUT.oldVillage.northBeachEastSeaCutout;
for (
  let z = northBeachEastSeaCutout.z;
  z < northBeachEastSeaCutout.z + northBeachEastSeaCutout.height;
  z++
)
  for (
    let x = northBeachEastSeaCutout.x;
    x < northBeachEastSeaCutout.x + northBeachEastSeaCutout.width;
    x++
  )
    if (MAPS.oldVillage.tiles[z]?.[x] !== undefined)
      MAPS.oldVillage.tiles[z][x] = 9;
for (const cell of LAYOUT.oldVillage.northBeachSandCorrections)
  if (MAPS.oldVillage.tiles[cell.z]?.[cell.x] !== undefined)
    MAPS.oldVillage.tiles[cell.z][cell.x] = 8;
for (const trim of LAYOUT.oldVillage.northBeachSeaTrims)
  for (let z = 0; z <= trim.maxZ; z++)
    if (MAPS.oldVillage.tiles[z]?.[trim.x] === 8)
      MAPS.oldVillage.tiles[z][trim.x] = 9;

// 港口東側外海擴充：往陣列尾端追加海面，既有建築、事件與傳送點座標不變。
export const PORT_OCEAN_EXPANSION = { east: 50 };
shiftMapLayout({
  tiles: MAPS.port.tiles,
  direction: "east",
  amount: PORT_OCEAN_EXPANSION.east,
  fillValue: 9,
  coordinateRoots: [LAYOUT.port],
  playerStart: MAPS.port.playerStart,
});
LAYOUT.port.width = MAPS.port.tiles[0].length;
// 舊城鎮擴高：從 12 排(z=0~11)往南加 3 排到 15 排(z=0~14)，讓它可以
// 跟港口(16 排，z=0~15)的西側整條邊界對齊、逐排走過去——不是單一
// 傳送點，是連續多格都能互通。新加的三排目前只是空地，之後有內容
// 再回頭補；用 push(往陣列尾端加)不是 unshift，既有的 z 座標(北側
// 門檻、木匠空屋、美術村門檻)完全不用動。
// 舊城鎮東側(x=13)跟港口西側(x=0)整條邊界都標成門檻(3)，冒出黃色
// 標記；只對到 z=0~14(舊城鎮的範圍)，港口多出來的最後一排(z=15)
// 沒有對應的舊城鎮列，不畫。
for (let z = 0; z < LAYOUT.port.oldVillageGate.height; z++) {
  const worldZ = LAYOUT.port.oldVillageGate.z + z;
  if (
    worldZ >= LAYOUT.port.oldVillageGate.beachStartZ &&
    worldZ <= LAYOUT.port.oldVillageGate.beachEndZ
  )
    MAPS.port.tiles[worldZ][LAYOUT.port.oldVillageGate.x + 1] = 8;
  MAPS.port.tiles[worldZ][LAYOUT.port.oldVillageGate.x] = 3;
}

// ==============================================================
// 1.4) 一次性往西擴 15 格安全空間，之後說「房子西 N」只要 N<=15
//    就有現成的格子可以用，不用每次都插入陣列、重算全部座標
// ==============================================================
export const X_OFFSET = 15;
MAPS.livingArea.tiles.forEach((row) =>
  row.unshift(...new Array(X_OFFSET).fill(0)),
);

// 向陣列前端正式加入北側五排，不使用非法的負 z 座標。
// 舊小屋的 tile 會跟著舊地圖下移，所以先清掉，再依 LAYOUT 重建新位置。
export const northRowWidth = MAPS.livingArea.tiles[0].length;
MAPS.livingArea.tiles.unshift(
  ...Array.from({ length: NORTH_EXPANSION }, () =>
    new Array(northRowWidth).fill(0),
  ),
);
// 先清掉牧場範圍內所有舊建築 tile，再依 LAYOUT.barn 重畫；否則小屋
// 橫向搬家時只清新位置，舊位置會留下不可見碰撞。
for (
  let z = Math.max(0, LAYOUT.pasture.z);
  z <
  Math.min(
    MAPS.livingArea.tiles.length,
    LAYOUT.pasture.z + LAYOUT.pasture.height,
  );
  z++
) {
  for (
    let x = LAYOUT.pasture.x;
    x < LAYOUT.pasture.x + LAYOUT.pasture.width;
    x++
  ) {
    if (
      MAPS.livingArea.tiles[z]?.[x] === 1 ||
      MAPS.livingArea.tiles[z]?.[x] === 3
    )
      MAPS.livingArea.tiles[z][x] = 0;
  }
}
for (let z = LAYOUT.barn.z; z < LAYOUT.barn.z + LAYOUT.barn.d; z++) {
  if (z < 0 || z >= MAPS.livingArea.tiles.length) continue;
  for (let x = LAYOUT.barn.x; x < LAYOUT.barn.x + LAYOUT.barn.w; x++)
    MAPS.livingArea.tiles[z][x] = 1;
}
// 清掉動物小屋門前偏左一格的樹；位置從穀倉門推導，不另寫絕對座標。
// 2026-09-03：小屋北移後這格可能落在北側平台(z<0，tiles 陣列外)，
// 跟上面 barn 牆體標記迴圈同一個道理——陣列外本來就沒有 tile=7 這種
// 死資料可清，跳過即可，不用讓陣列外索引直接炸掉。
{
  const treeZ = LAYOUT.barn.z + LAYOUT.barn.d + 2;
  if (treeZ >= 0 && treeZ < MAPS.livingArea.tiles.length) {
    MAPS.livingArea.tiles[treeZ][LAYOUT.barn.doorX - 1] = 0;
  }
}

// 除錯工具找到最後一批死資料：x=17~19,z=13~14 還留著 tile=7，是很多輪
// 之前那個 6 格小農田的殘骸。現在的 9 塊大農田系統完全不靠陣列裡的
// tile=7 運作(渲染跟互動都讀 FARMLAND_TILES，不是陣列本身)，這幾格
// 純粹是死資料，清掉
[13, 14].forEach((z) => {
  [17, 18, 19].forEach((x) => {
    MAPS.livingArea.tiles[z + NORTH_EXPANSION][x] = 0;
  });
});

// 除錯工具抓到另一個舊帳：之前幾輪搬湖的位置，每次只有「在新位置寫水」，
// 沒有把舊位置清回草地，這裡殘留了一小塊(x=16~18,z=8~10)。順手清掉
[8, 9, 10].forEach((z) => {
  [16, 17, 18].forEach((x) => {
    MAPS.livingArea.tiles[z + NORTH_EXPANSION][x] = 0;
  });
});

// ==============================================================
// 1.45) 先在陣列尾端補足農田空間；第四排田需要再增加四列。
// ==============================================================
(function extendBaseRowsForFarm() {
  const width = MAPS.livingArea.tiles[0].length; // 14，這時候還沒插緩衝欄/沙灘欄
  for (let i = 0; i < 13; i++)
    MAPS.livingArea.tiles.push(new Array(width).fill(0));
})();

// ==============================================================
// 1.5) 在地圖右邊擴建一片海邊 — tile 8 = 沙灘（可走）、tile 9 = 海（不可走）。
//    海面本身不在這裡逐格建置，而是在 buildMap() 裡另外蓋成一整片可
//    變形的網格，這樣才能在 animate() 裡逐頂點做波浪動畫
// ==============================================================
// 原本的 3 格緩衝再增加 5 格，整條懸崖、沙灘與海面一起東移。
MAPS.livingArea.tiles.forEach((row) =>
  row.splice(26, 0, ...new Array(3 + LAYOUT.coast.eastExpansion).fill(0)),
);

export const BEACH_SAND_COLS = LAYOUT.coast.sandCols;
export const BEACH_OCEAN_COLS = LAYOUT.coast.oceanCols;
export const BEACH_BAND_WIDTH = BEACH_SAND_COLS + BEACH_OCEAN_COLS;
MAPS.livingArea.tiles.forEach((row, z) => {
  // 沙灘/海交界沿 z 抖動，總寬度固定不變（陣列仍是矩形），只有沙灘跟
  // 海各自佔幾格會跟著波動，海岸線才不會是一條直線
  const sandCols = Math.min(
    BEACH_BAND_WIDTH - 3,
    Math.max(3, BEACH_SAND_COLS + coastShoreJitter(z)),
  );
  const oceanCols = BEACH_BAND_WIDTH - sandCols;
  for (let i = 0; i < sandCols; i++) row.push(8);
  for (let i = 0; i < oceanCols; i++) row.push(9);
});

// 西北山區入口目前只開放到前段階梯；最後一格是岩壁，保留未來切換山區地圖。
// 2026-08-26 傳送點上下(z)各擴張 1 格，跟山區那側(homeGate)配對
// 一起改；width 只是標記涵蓋範圍，實際擴張(觸發事件 count/index
// offset)在 build-map.ts 那組 touch 事件裡做。
export const MOUNTAIN_GATE_BLOCKER = {
  x: LAYOUT.mountainGateway.startX - (LAYOUT.mountainGateway.steps - 1),
  z: LAYOUT.mountainGateway.startZ - (LAYOUT.mountainGateway.steps - 1),
  width: 3,
};
for (let i = -1; i <= 1; i++) {
  const z = MOUNTAIN_GATE_BLOCKER.z + i;
  if (z >= 0 && z < MAPS.livingArea.tiles.length) {
    MAPS.livingArea.tiles[z][MOUNTAIN_GATE_BLOCKER.x] = 3;
  }
}

// 女神祠堂步道：原本的沙灘只到 x=46 左右就變成海(9)；在最北側三排
// (z=0~2)把接下來 15 格海硬改成沙灘(8)，鑿出一條往東延伸的步道，
// 通往這輪新設的祠堂入口。退潮限定的判斷邏輯還沒接，這條路現在是
// 「一直都能走」，之後要接退潮機制時再讓這塊沙灘依情況顯示/隱藏。
// 只覆寫這 3×15 格，不動其餘沙灘/海的既有生成邏輯；上面 coast.oceanCols
// 已經加大過，這排改完後面仍留得下至少一格真的海，海岸線偵測才不會
// 找不到海而跑掉。
// 西端多含一格抬高入口；終點仍固定在 x=62，不改祠堂傳送位置。
export const SHRINE_PATH_START_X = 46;
export const SHRINE_PATH_LENGTH = 17;
// 步道刻意墊高、浮出海面(不是跟一般沙灘一樣貼著水面)，視覺上像一條
// 從海裡浮出來的沙洲步道；makeShrinePathCauseway()(build-map.ts)跟
// groundY()(scene-sky.ts)都要讀同一個數字，保持高度跟碰撞地板對齊。
export const SHRINE_PATH_ELEVATION = 0.5;
for (let z = 0; z <= 2; z++) {
  for (let i = 0; i < SHRINE_PATH_LENGTH; i++) {
    MAPS.livingArea.tiles[z][SHRINE_PATH_START_X + i] = 8;
  }
}
// 步道西端的幾何從半格邊界開始，入口南側也補一格沙灘，避免沙灘與
// 堤道之間殘留單格海水裂縫。
MAPS.livingArea.tiles[2][SHRINE_PATH_START_X - 1] = 8;

// ==============================================================
// 1.55) 農田依 LAYOUT 排列大區塊(每塊 3×3，區塊間留 1 格路當 gap)，
//    湖也順便放大——原本 3×3(9格) 放大到空間允許的極限
// ==============================================================
export const FARM_ORIGIN = LAYOUT.farm; // 農田左上角，現在西移到 x=3
export const FARMLAND_TILES = [];
export const FARM_BLOCK_STEP = FARM_ORIGIN.plotSize + FARM_ORIGIN.gap;
export const FARM_MAX_X =
  FARM_ORIGIN.x +
  (FARM_ORIGIN.columns - 1) * FARM_BLOCK_STEP +
  FARM_ORIGIN.plotSize -
  1;
export const FARM_MAX_Z =
  FARM_ORIGIN.z +
  (FARM_ORIGIN.rows - 1) * FARM_BLOCK_STEP +
  FARM_ORIGIN.plotSize -
  1;
for (let bc = 0; bc < FARM_ORIGIN.columns; bc++) {
  for (let br = 0; br < FARM_ORIGIN.rows; br++) {
    for (let px = 0; px < FARM_ORIGIN.plotSize; px++) {
      for (let pz = 0; pz < FARM_ORIGIN.plotSize; pz++) {
        FARMLAND_TILES.push([
          FARM_ORIGIN.x + bc * FARM_BLOCK_STEP + px,
          FARM_ORIGIN.z + br * FARM_BLOCK_STEP + pz,
        ]);
      }
    }
  }
}
// 區塊間的走道完全由欄／排數推導，會自動貫穿整片農田。用 repaintRegion
// 記錄這次實際畫了哪些格子，下次 LAYOUT.farm 搬家、這段重新執行時會
// 先清掉舊格子——不能像湖那樣直接「清掉所有 tile===5」，這個值同時
// 被道路/樓梯/行道樹間隙共用，見 region-paint.ts 開頭的說明。
{
  const farmPathCells: Array<[number, number]> = [];
  for (let bc = 1; bc < FARM_ORIGIN.columns; bc++) {
    const pathX = FARM_ORIGIN.x + bc * FARM_BLOCK_STEP - FARM_ORIGIN.gap;
    for (let z = FARM_ORIGIN.z; z <= FARM_MAX_Z; z++)
      farmPathCells.push([pathX, z]);
  }
  for (let br = 1; br < FARM_ORIGIN.rows; br++) {
    const pathZ = FARM_ORIGIN.z + br * FARM_BLOCK_STEP - FARM_ORIGIN.gap;
    for (let x = FARM_ORIGIN.x; x <= FARM_MAX_X; x++)
      farmPathCells.push([x, pathZ]);
  }
  repaintRegion(MAPS.livingArea.tiles, "farm-paths", farmPathCells, 5);
}

// ==============================================================
// 1.56) 花田——露比事件結尾埋的伏筆(「牧場不是有空地嗎？」)現在接上：
//    直接沿用小花園(LAYOUT.garden)那塊地當圍籬範圍。跟 FARMLAND_TILES
//    同一套「固定座標清單 + xxxState 物件」寫法，只是花的物種不像作物
//    只有一種——每格種的是玩家手上當時拿的哪種花，見 game-state.ts 的
//    flowerBedState/plantFlowerBed()。
//    2026-09-04：原本只挑 6 格(dx=2/4/6、dz=2/5)當花圃、格子間留草地
//    間隔，Zeppelin 反饋看起來像圍籬裡東一塊西一塊，改成整片鋪土；
//    第一版鋪到圍籬柱子那一圈([livingArea] (25,31)~(32,37))，Zeppelin
//    覺得太滿要收一圈，改成圍籬內縮一格的
//    [livingArea] (26,32)~(31,36)(dx=1..width-2、dz=1..height-2)。
// ==============================================================
export const FLOWER_BED_TILES: Array<[number, number]> = (() => {
  const tiles: Array<[number, number]> = [];
  for (let dz = 1; dz <= LAYOUT.garden.height - 2; dz++) {
    for (let dx = 1; dx <= LAYOUT.garden.width - 2; dx++) {
      tiles.push([LAYOUT.garden.x + dx, LAYOUT.garden.z + dz]);
    }
  }
  return tiles;
})();

// 湖再放大一輪，往「房子左上」拉：原本 5×4(20格)，現在 6×6(36格)。
// 講清楚空間上的硬限制：房子在 x=5~7，西邊到地圖邊界(山區背景開始的
// 地方)只有大概 5~6 格寬，9 格寬真的放不下，除非房子搬家或地圖再往
// 西擴——這次先把牧場往東擠一點，把讓出來的空間全部給湖
// 每次依 LAYOUT 重建湖泊前，先清掉所有舊湖水，避免搬遷後殘留死資料。
MAPS.livingArea.tiles.forEach((row) =>
  row.forEach((tile, x) => {
    if (tile === 6) row[x] = 0;
  }),
);
for (let z = LAYOUT.lake.z; z < LAYOUT.lake.z + LAYOUT.lake.height; z++) {
  for (let x = LAYOUT.lake.x; x < LAYOUT.lake.x + LAYOUT.lake.width; x++) {
    MAPS.livingArea.tiles[z][x] = isInsideLakeShape(x, z) ? 6 : 0;
  }
}
export const LAKE_SHADE_TREE_TILES = LAYOUT.lake.shadeTreeOffsets.map(
  ([dx, dz]) => [LAYOUT.lake.x + dx, LAYOUT.lake.z + dz],
);
LAKE_SHADE_TREE_TILES.forEach(([x, z]) => {
  if (MAPS.livingArea.tiles[z]?.[x] === 0) MAPS.livingArea.tiles[z][x] = 2;
});

// 湖的外框清理可能掃到相鄰建築；地形完成後以 buildings 為唯一資料源重建
// 完整佔地，確保主屋與穀倉的視覺、tile 碰撞永遠一致。
MAPS.livingArea.buildings.forEach((building) => {
  for (let z = building.z; z < building.z + building.d; z++) {
    if (z < 0 || z >= MAPS.livingArea.tiles.length) continue;
    for (let x = building.x; x < building.x + building.w; x++) {
      MAPS.livingArea.tiles[z][x] = 1;
    }
  }
});

// 果園南側紅色風車占地。
for (
  let z = LAYOUT.windmill.z;
  z < LAYOUT.windmill.z + LAYOUT.windmill.d;
  z++
) {
  for (
    let x = LAYOUT.windmill.x;
    x < LAYOUT.windmill.x + LAYOUT.windmill.w;
    x++
  ) {
    MAPS.livingArea.tiles[z][x] = 1;
  }
}

// ==============================================================
// 1.6) 緩坡只留一條走廊開放(z=14~16)，其餘 z 的 x=14~16 變成擋路的懸崖
//    （原本是 x=11~13，因為上面多插了 3 格草地緩衝，整個右移 3 格）
// ==============================================================
export const RAMP_CORRIDOR_MIN_Z = 14 + NORTH_EXPANSION;
export const RAMP_CORRIDOR_MAX_Z = 16 + NORTH_EXPANSION;
MAPS.livingArea.tiles.forEach((row, z) => {
  const rampX = LAYOUT.coast.rampX;
  if (z < RAMP_CORRIDOR_MIN_Z || z > RAMP_CORRIDOR_MAX_Z) {
    for (let x = rampX; x < rampX + LAYOUT.coast.rampWidth; x++) row[x] = 1;
  } else {
    for (let x = rampX; x < rampX + LAYOUT.coast.rampWidth; x++) row[x] = 0;
  }
});

// ==============================================================
// 1.7) 城區——參考圖裡「下方城區」的位置卡位。純平面／方塊佔位，還沒做
//    細節，先確保地圖南邊有路接得過去，佈局比例對了，之後再回頭精修
// ==============================================================
export const TOWN_ROWS = 6;
export const TOWN_Z_START = MAPS.livingArea.tiles.length; // 現在是 25（農田南移後多佔了 3 排）
(function extendTown() {
  const width = MAPS.livingArea.tiles[0].length;
  for (let i = 0; i < TOWN_ROWS; i++) {
    const row = new Array(width).fill(0);
    MAPS.livingArea.tiles.push(row);
  }
})();

// 清除農田右側邊緣的樹，以及主屋門正前方、與門同一直線的樹。
MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.farm.x + 10] = 0;
MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.house.doorX] = 0;

// 牧草地保持開闊：清掉範圍內原始地圖的普通樹；果樹由果園系統獨立生成。
for (
  let z = Math.max(0, LAYOUT.pasture.z);
  z < LAYOUT.pasture.z + LAYOUT.pasture.height;
  z++
) {
  for (
    let x = LAYOUT.pasture.x;
    x < LAYOUT.pasture.x + LAYOUT.pasture.width;
    x++
  ) {
    if (MAPS.livingArea.tiles[z][x] === 2) MAPS.livingArea.tiles[z][x] = 0;
  }
}

// 主屋門外道路以門中心對齊，寬三格並一路筆直延伸到地圖最南端。
export const HOUSE_ROAD_X = LAYOUT.house.doorX;
export const HOUSE_ROAD_START_Z = LAYOUT.house.z + LAYOUT.house.d + 1;
export const HOUSE_ROAD_HALF_WIDTH = Math.floor(LAYOUT.houseRoad.width / 2);
for (let z = HOUSE_ROAD_START_Z; z < MAPS.livingArea.tiles.length; z++) {
  for (
    let x = HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH;
    x <= HOUSE_ROAD_X + HOUSE_ROAD_HALF_WIDTH;
    x++
  ) {
    MAPS.livingArea.tiles[z][x] = 5;
  }
}

// 第二天早上「村長在家門口等你」事件（day2-morning-event.ts）的定位點：
// 玩家門前這條路已經有 HOUSE_ROAD_X/HOUSE_ROAD_START_Z 這組現成的「家門口」
// 座標，直接沿用，不要另外寫死一組容易跟著房子搬家脫鉤的數字——之後房子
// 位置改了，這裡跟著自動更新。
// 2026-09-02 第二輪：Zeppelin 給的完整劇本把玩家/村長各往南挪一格
// （(21,17)/(21,18) 改成 (21,18)/(21,19)），一樣沿用 HOUSE_ROAD_X／
// HOUSE_ROAD_START_Z 推導，不寫死新數字。
export const DAY_TWO_MORNING_ARRIVAL = {
  player: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z + 1 },
  mayor: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z + 2 },
};

// 第二天早上劇本第二段——港口迎接歐文(木匠)＋露比(藝術家)登島。玩家/
// 村長的落點沿用既有的 LAYOUT.port.carpenterMeet 觸發區（原本木匠碼頭
// 事件用的同一塊區域，中心點 (3,21)，南移一格站在區域內＝(3,22)，跟
// Zeppelin 給的座標吻合，不是巧合、是同一塊地方），歐文/露比在旁邊代表
// 剛下船，沒有精確的「跳板落地點」資料可推導，用小 offset 站在主角右側。
// 2026-09-04 Zeppelin 改版港口見面戲佔位：兩排面對面——主角/村長站
// carpenterMeet 西側那一排(x)，歐文/露比站東側那一排(x+2)，兩排各自
// 南北錯開(z / z+2)、面向對方。原本(2026-09-03 那版)是主角/村長同排
// 面向船、歐文/露比也同排面向船，這次改成迎接的人面向被迎接的人。
export const DAY_TWO_PORT_ARRIVAL = {
  player: {
    x: LAYOUT.port.carpenterMeet.x,
    z: LAYOUT.port.carpenterMeet.z,
  },
  mayor: {
    x: LAYOUT.port.carpenterMeet.x,
    z: LAYOUT.port.carpenterMeet.z + 2,
  },
  carpenter: {
    x: LAYOUT.port.carpenterMeet.x + 2,
    z: LAYOUT.port.carpenterMeet.z,
  },
  artist: {
    x: LAYOUT.port.carpenterMeet.x + 2,
    z: LAYOUT.port.carpenterMeet.z + 2,
  },
};

// 主屋門前道路往西分支；接近農田的北側入口向北加寬兩格，形成三格深的入口。
// 農田本體四周另鋪一圈一格寬道路，南側不再繼續向城區延伸。
// 路線全部由 LAYOUT 推導；之後移動房屋或農田時不需要重寫絕對座標。
export const FARM_ACCESS_X = LAYOUT.farm.x - 1;
export const FARM_ACCESS_NORTH_Z = LAYOUT.farm.z - 1;
export const FARM_ACCESS_SOUTH_Z = FARM_MAX_Z + 1;
export const FARM_ACCESS_EAST_X = FARM_MAX_X + 1;
for (let dz = 0; dz < LAYOUT.farmAccessRoad.width; dz++) {
  const z = FARM_ACCESS_NORTH_Z - dz;
  for (let x = FARM_ACCESS_X; x <= HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH; x++) {
    MAPS.livingArea.tiles[z][x] = 5;
  }
}
for (let z = FARM_ACCESS_NORTH_Z; z <= FARM_ACCESS_SOUTH_Z; z++) {
  MAPS.livingArea.tiles[z][FARM_ACCESS_X] = 5;
  MAPS.livingArea.tiles[z][FARM_ACCESS_EAST_X] = 5;
}
for (let x = FARM_ACCESS_X; x <= FARM_ACCESS_EAST_X; x++) {
  MAPS.livingArea.tiles[FARM_ACCESS_NORTH_Z][x] = 5;
  MAPS.livingArea.tiles[FARM_ACCESS_SOUTH_Z][x] = 5;
}

// 在海堤走廊位置向東鋪出三格寬支路，接到階梯前；階梯本身由地形系統渲染。
export const COAST_ROAD_CENTER_Z = Math.floor(
  (RAMP_CORRIDOR_MIN_Z + RAMP_CORRIDOR_MAX_Z) / 2,
);
export const COAST_ROAD_HALF_WIDTH = Math.floor(LAYOUT.coastRoad.width / 2);
for (
  let z = COAST_ROAD_CENTER_Z - COAST_ROAD_HALF_WIDTH;
  z <= COAST_ROAD_CENTER_Z + COAST_ROAD_HALF_WIDTH;
  z++
) {
  for (
    let x = HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH;
    x < LAYOUT.coast.rampX;
    x++
  ) {
    MAPS.livingArea.tiles[z][x] = 5;
  }
}

// 略過最上方左右各兩棵，從農田起點往南四格後開始種植行道樹。
export const AVENUE_TREE_TILES = [];
for (let z = LAYOUT.farm.z + 4; z < MAPS.livingArea.tiles.length; z += 2) {
  [HOUSE_ROAD_X - 2, HOUSE_ROAD_X + 2].forEach((x) => {
    AVENUE_TREE_TILES.push([x, z]);
    MAPS.livingArea.tiles[z][x] = 2;
  });
}
export const AVENUE_TREE_KEYS = new Set(
  AVENUE_TREE_TILES.map(([x, z]) => `${x},${z}`),
);
export const SOUTHERNMOST_AVENUE_TREE_Z = Math.max(
  ...AVENUE_TREE_TILES.map(([, z]) => z),
);
// 清掉休息區入口旁的舊樹，讓人能從行道樹間穿進兩個新區域。
MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.restArea.x - 1] = 0;

// 港口連通點已經改到南側(37~46,42)整排，這裡不再是門檻，改回原本的
// 沙灘(8)，清掉殘留的黃色門檻視覺標記。
MAPS.livingArea.tiles[20][40] = 8;

// 舊城鎮連通點(x=20~22, z=42)——生活區最南端。
[20, 21, 22].forEach((x) => {
  MAPS.livingArea.tiles[42][x] = 5;
});
// 清掉上一版誤往左鋪到 x=13~15 的南向支路；z=37 是既有橫路，保留。
for (let z = 38; z <= 42; z++) {
  for (let x = 13; x <= 15; x++) MAPS.livingArea.tiles[z][x] = 0;
}
for (let z = 37; z < LAYOUT.livingArea.oldVillageGate.z; z++) {
  for (let i = 0; i < LAYOUT.livingArea.oldVillageGate.width; i++) {
    MAPS.livingArea.tiles[z][LAYOUT.livingArea.oldVillageGate.x + i] = 5;
  }
}
for (let i = 0; i < LAYOUT.livingArea.oldVillageGate.width; i++) {
  MAPS.livingArea.tiles[LAYOUT.livingArea.oldVillageGate.z][
    LAYOUT.livingArea.oldVillageGate.x + i
  ] = 3;
}

// 主角家放大後，原本位於正門左前方的舊樹會擋住門面與進出視線。
// 座標從房屋資料推導，清除 tile 同時移除視覺與碰撞。
export const HOUSE_FRONT_TREE = {
  x: LAYOUT.house.doorX - 2,
  z: LAYOUT.house.z + LAYOUT.house.d + 1,
};
MAPS.livingArea.tiles[HOUSE_FRONT_TREE.z][HOUSE_FRONT_TREE.x] = 0;
// 港口連通點(x=37~46, z=42) 的門檻標記本身放在檔案後段，跟「南側
// 延伸地形補沙灘/海資料」那段一起處理——要先把 z=37~42 補上真的
// 沙灘/海，門檻才不會蓋在假資料上面。

// ==============================================================
// 木匠抵達——第一個真正的劇情事件，之後招募其他角色可以複製這個
// 「stage 字串 + 觸碰事件推進 + showDialogSequence(onComplete)」的框架。
// stage 一路往前推，不會回頭，觸發點自己檢查 stage 就能防止重複觸發：
//   not_started      → 港口觸碰事件觸發碼頭見面
//   en_route_village → 舊城鎮空屋觸碰事件觸發抵達空屋 + 材料檢查
//   construction     → 空屋旁顯示施工中標記，等 CARPENTER_CONSTRUCTION_DAYS 天
//   ready_for_move_in→ 天數到了，晚上回空屋觸發入住場景
//   moved_in         → 木匠正式出現在 livingArea，恢復原本的排程走動
// 宣告要放在 events 陣列前面：events 是一般陣列常值，裡面的座標會立刻
// 求值（不像函式內容那樣延後執行），晚宣告會直接撞到 TDZ 錯誤。
// ==============================================================
// 雜貨店正門口——2026-09-05 補上，取代 build-map.ts events 陣列裡原本
// 硬寫死座標(149,26)/(150,26)的開發用捷徑傳送點：那組數字是雜貨店還
// 沒做外觀時「先送過去方便建模/測試」的暫定值，跟雜貨店實際建築
// (LAYOUT.oldVillage.houses 裡 role:"generalStore" 那棟)完全對不上，
// 一直沒有回頭校準。跟 CARPENTER_HOUSE/CARPENTER_DOORSTEP 同一招，用
// find(role) 動態算，房子之後再搬家這裡不用跟著手動改數字。
const generalStoreHouseEntry = LAYOUT.oldVillage.houses.find(
  (h) => h.role === "generalStore",
);
export const GENERAL_STORE_DOORSTEP = {
  x: generalStoreHouseEntry.doorX,
  z: generalStoreHouseEntry.z + generalStoreHouseEntry.d,
};
export const CARPENTER_HOUSE = { ...LAYOUT.oldVillage.carpenterHouse };
export const CARPENTER_DOORSTEP = {
  x: LAYOUT.oldVillage.carpenterHouse.doorX,
  z: LAYOUT.oldVillage.carpenterHouse.z + LAYOUT.oldVillage.carpenterHouse.d,
};
export const CARPENTER_EVENT_WAIT_POS = {
  x: CARPENTER_DOORSTEP.x,
  z: CARPENTER_DOORSTEP.z + 1,
};
export const CARPENTER_MATERIALS = { wood: 10, stone: 5 };
export const CARPENTER_CONSTRUCTION_DAYS = 2;
export const carpenterQuest = {
  stage: "not_started",
  constructionStartDay: -1,
};

// ==============================================================
// 露比(藝術家)個人事件——2026-09-03 Zeppelin：「木匠事件結束後準備接
// 露比事件」。這輪先只處理「人要站在哪、面向哪」，文本之後才會給，故意
// 不比照 carpenterQuest/chefQuest 整套 stage 機器先寫好——只留一個最小
// 的 stage 開關，day2-morning-event.ts 的 completeDayTwoMorningEvent()
// 推進到 "waiting_oldVillage" 之後，game-loop.ts 就把她釘在這個定點
// （蓋掉 npc-defs.ts 原本的日常排程，跟 CARPENTER_EVENT_WAIT_POS 那段
// 同一招），等真正的招募/個人事件劇本寫出來，再往下擴充成觸碰事件 +
// 更多 stage。
// ==============================================================
// 2026-09-04 Zeppelin 給的開場分鏡指定站位：(142,18)，跟原本
// (142,17)（比照 CARPENTER_EVENT_WAIT_POS 的公式推算）差一格。這個
// 分鏡出來之後，露比不再靠玩家自己走過去踩觸碰點發現(那條路徑已經
// 沒有用到，見 day2-morning-event.ts completeDayTwoMorningEvent()/
// beginMountainRoute() 的說明)，所以直接照分鏡給的座標定案。
export const ARTIST_EVENT_WAIT_POS = { x: 142, z: 18 };
// 2026-09-03：文本補齊，正式實作「隔壁那個奇怪的人」——木匠事件結束後
// 露比先在 ARTIST_EVENT_WAIT_POS 等，玩家互動觸發整段個人事件。stage
// 繼續往前推：
//   waiting_oldVillage → intro（互動觸發，立刻推進防止重複觸發，涵蓋整段
//                         對話直到出發上山）
//   intro → gatheringFlowers（傳送到山上，玩家自由採集三種顏色野花）
//   gatheringFlowers → returning（湊到三色，傳送回舊城鎮，接顏料 CG 戲）
//   returning → complete（個人事件完成，好感 +30，之後恢復日常排程）
// flowerStartCounts：進入 gatheringFlowers 時拍一份 inventory.wildflowers
// 快照，跟 dayTwoMorningEvent 的 woodStart/stoneStart 同一招，用來判斷
// 玩家在「這次採集」期間新增了幾種顏色，不是看終身累積總數。
export const artistQuest = {
  stage: "not_started" as
    | "not_started"
    | "waiting_oldVillage"
    | "intro"
    | "gatheringFlowers"
    | "returning"
    | "complete",
  flowerStartCounts: null as Partial<
    Record<import("./wildflowers").FlowerSpeciesId, number>
  > | null,
};

// ==============================================================
// 克拉拉(植物學家)個人事件——第三天早上劇本，Zeppelin 2026-09-04 給的
// 完整版：跟歐文/露比「玩家去港口接人」相反，這次是她主動上門拜訪牧場
// （見 day3-morning-event.ts 開頭說明），帶到蜂箱那塊空地聊完，直接
// 架設蜂箱、呼叫 game-state.ts 的 unlockBeehive()——那邊蜂箱系統本來
// 就是「初始無，等第三天事件解鎖」的設計，這次補的就是那個事件本身。
//
// 門口／對話站位沿用 HOUSE_ROAD_X/HOUSE_ROAD_START_Z 這組現成的「家門
// 口」座標系，跟 DAY_TWO_MORNING_ARRIVAL 同一招，房子之後搬家這裡不用
// 跟著手動改數字：玩家 (HOUSE_ROAD_X, HOUSE_ROAD_START_Z+1) = (21,18)，
// 克拉拉站在玩家再往南兩格 (21,20)——跟 Zeppelin 給的座標吻合。
export const DAY_THREE_BOTANIST_ARRIVAL = {
  player: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z + 1 },
  botanist: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z + 3 },
};

// 蜂箱空地的演出站位跟隨 LAYOUT.beehive，主角在左、克拉拉在右。
export const DAY_THREE_BEEHIVE_SCENE = {
  player: { x: LAYOUT.beehive.x - 1, z: LAYOUT.beehive.z },
  botanist: { x: LAYOUT.beehive.x + 1, z: LAYOUT.beehive.z },
};

// stage 跟 artistQuest 同一套寫法，但這次沒有「自由採集」的中間態——
// 全程靠 showDialogSequence 串接 callback 就能跑完一場戲，只需要一個
// 中繼狀態：
//   not_started → intro（劇情觸發，涵蓋門口寒暄～蜂箱架設～收尾全程）
//   intro → complete（個人事件完成，好感 +30，unlockBeehive()，之後
//                      恢復日常排程）
// scenePos：event 進行中，game-loop.ts 逐幀把她釘在這個座標（跟
// dayTwoMorningEvent.holdPositions 同一種「固定站位」道理，只是這裡只
// 有克拉拉一個人，不需要整份 Record，直接放單一物件就夠），劇本裡每次
// 場景切換(黑屏傳送)都會更新這個值；event 沒在跑的時候是 null。
export const botanistQuest = {
  stage: "not_started" as "not_started" | "intro" | "complete",
  scenePos: null as { x: number; z: number; rotY: number } | null,
};

export const OCEANOGRAPHER_COAST_SCENE = {
  player: { x: LAYOUT.oysterFarm.x - 3, z: LAYOUT.oysterFarm.z },
  oceanographer: { x: LAYOUT.oysterFarm.x - 2, z: LAYOUT.oysterFarm.z },
};

export const oceanographerQuest = {
  stage: "not_started" as "not_started" | "intro" | "complete",
  scenePos: null as { x: number; z: number; rotY: number } | null,
};

// events（地圖觸碰/互動事件表）需要 loadMap/handleCarpenterDockTouch/
// handleCarpenterDoorstepTouch，這些函式所在的模組會遞移載入
// scene-sky.ts（THREE.WebGLRenderer／document.getElementById 等 DOM/WebGL
// 副作用），若放在這個檔案會讓 map-debug.ts 之類的純 Node 腳本無法單獨
// import LAYOUT/MAPS。因此改放進 build-map.ts，見該檔案尾端。

// ==============================================================
// 廚師抵達——第二個角色，複製木匠那套「stage 字串 + 觸碰事件推進 +
// showDialogSequence(onComplete)」框架，這次刻意不抽成共用系統
// （只有兩個樣本，抽象容易抽錯方向，等第三個角色出現再回頭歸納）。
// stage 一路往前推：
//   not_started → 港口觸碰事件觸發碼頭見面
//   arrived     → 民宿觸碰事件觸發現場看屋 + 她說出招募條件，
//                 sharedMealCount 歸零開始累計
//   proving     → 沒有天數門檻，等玩家在休息區、白天到傍晚的時段內、
//                 帶著收成、旁邊有其他 NPC 在場時觸發「共餐」，累積到門檻次數
//                 為止；期間再去敲門只回一句簡短反應，不重播整段開場
//                 白——這是跟木匠事件唯一刻意不同的地方，木匠材料不夠
//                 時 stage 會退回 en_route_village，導致下次敲門重播
//                 整段對話，共餐要等好幾天，重播整段太煩。
//   renovating  → 條件達成，她說廚房自己整理，等 CHEF_RENOVATION_DAYS 天
//   ready_for_move_in → 天數到了，晚上回民宿觸發入住場景
//   moved_in    → 廚師正式出現在 livingArea，恢復排程走動
// CHEF_HOUSE/CHEF_DOORSTEP 故意還沒定義：她的家/行程座標要等這套流程
// 定案、真的需要擺放時才決定，這裡先只放跟座標無關的 quest 狀態。
// ==============================================================
export const CHEF_MEAL_THRESHOLD = 3; // 累積這麼多次「共餐」才算證明給她看
export const CHEF_MEAL_WINDOW_START = 6; // 只有這段時間內觸發的共餐才算數，
export const CHEF_MEAL_WINDOW_END = 20; // 不限定哪一餐，整個白天到傍晚都算
export const CHEF_RENOVATION_DAYS = 2; // 比木匠的 2 天蓋房子稍短：她只是整理廚房
export const chefQuest = {
  stage: "not_started",
  renovatingStartDay: -1,
  sharedMealCount: 0,
  lastMealDay: -1, // 同一天只能算一次共餐，避免站著狂按 E 洗數字
};

// 生活區南側延伸地形(z=37~42)原本是純視覺、全部草地(0)：z=36 是真實
// 地形資料(牆/沙灘/海)的最後一排，過了那排海面網格找不到真的海，會
// 退化成固定座標往南延伸蓋住這片草地——玩家看到的是「海」，踩起來
// 卻是草地(0，不擋路)，反過來也一樣：南側其餘看起來像草地的地方
// 其實該是海，卻沒有真的擋路資料。這裡用跟 z<=36 同一組公式(coastShoreJitter
// + BEACH_SAND_COLS/BEACH_BAND_WIDTH)把 z=37~42 也補上真的沙灘(8)/
// 海(9)，讓這六排的視覺跟碰撞終於一致；放在檔案最後、所有列都已經
// push 完成之後執行，才不會撞到「該列還不存在」的錯誤（跟上面女神
// 祠堂步道那段踩過的坑一樣）。
for (let z = 37; z <= 42; z++) {
  const row = MAPS.livingArea.tiles[z];
  const sandCols = Math.min(
    BEACH_BAND_WIDTH - 3,
    Math.max(3, BEACH_SAND_COLS + coastShoreJitter(z)),
  );
  const oceanCols = BEACH_BAND_WIDTH - sandCols;
  for (let i = 0; i < sandCols; i++) row[37 + i] = 8;
  for (let i = 0; i < oceanCols; i++) row[37 + sandCols + i] = 9;
}
// 港口連通點(37~46,42)蓋在剛補上的沙灘資料上面，門檻(3)覆寫掉那幾格
// 的沙灘值，其餘沙灘/海維持剛算出來的樣子。
for (
  let x = LAYOUT.livingArea.portGate.x;
  x < LAYOUT.livingArea.portGate.x + LAYOUT.livingArea.portGate.width;
  x++
) {
  MAPS.livingArea.tiles[LAYOUT.livingArea.portGate.z][x] = 3;
}

// ==============================================================
// 2) A* 網格路徑規劃 — 只有上下左右四個方向，跟玩家移動同一套邏輯，
//    這樣走出來的路徑「感覺」才會跟這個世界一致，不會忽然出現斜線
// ==============================================================
export function aStar(start, goal, cols, rows, isBlockedFn) {
  const key = (x, z) => `${x},${z}`;
  const goalKey = key(goal.x, goal.z);
  const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

  const gScore = new Map([[key(start.x, start.z), 0]]);
  const cameFrom = new Map();
  const open = [{ x: start.x, z: start.z, f: heuristic(start, goal) }];
  const closed = new Set();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const ck = key(current.x, current.z);
    if (ck === goalKey) {
      const path = [{ x: current.x, z: current.z }];
      let k = ck;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k);
        path.unshift(prev);
        k = key(prev.x, prev.z);
      }
      return path;
    }
    closed.add(ck);
    const neighbors = [
      { x: current.x + 1, z: current.z },
      { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x, z: current.z - 1 },
    ];
    for (const nb of neighbors) {
      if (nb.x < 0 || nb.x >= cols || nb.z < 0 || nb.z >= rows) continue;
      if (isBlockedFn(nb.x, nb.z)) continue;
      const nk = key(nb.x, nb.z);
      if (closed.has(nk)) continue;
      const tentativeG = gScore.get(ck) + 1;
      if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, { x: current.x, z: current.z });
        const f = tentativeG + heuristic(nb, goal);
        const existing = open.find((o) => o.x === nb.x && o.z === nb.z);
        if (existing) existing.f = f;
        else open.push({ x: nb.x, z: nb.z, f });
      }
    }
  }
  return null; // 找不到路（例如目標被完全封死）
}

/**
 * 整張地圖平移時的座標所有權清單。傳送端點必須登記在它實際所在的地圖，
 * 不以目的地命名；shiftRegisteredMap() 才能只搬正確的一側。
 */
export const MAP_SHIFT_REGISTRY = {
  livingArea: {
    tiles: MAPS.livingArea.tiles,
    coordinateRoots: [
      LAYOUT.livingArea,
      LAYOUT.house,
      LAYOUT.barn,
      LAYOUT.pasture,
      LAYOUT.orchard,
      LAYOUT.windmill,
      LAYOUT.restArea,
      LAYOUT.garden,
      LAYOUT.farm,
      LAYOUT.lake,
      LAYOUT.coast,
      LAYOUT.mountainBand,
      LAYOUT.mountainGateway,
      MAPS.livingArea.buildings,
    ],
    playerStart: MAPS.livingArea.playerStart,
  },
  oldVillage: {
    tiles: MAPS.oldVillage.tiles,
    coordinateRoots: [
      LAYOUT.oldVillage,
      OLD_VILLAGE_RAILS,
      MAPS.oldVillage.placeholders,
    ],
    playerStart: MAPS.oldVillage.playerStart,
  },
  port: {
    tiles: MAPS.port.tiles,
    coordinateRoots: [LAYOUT.port],
    playerStart: MAPS.port.playerStart,
  },
  mountain: {
    tiles: MAPS.mountain.tiles,
    coordinateRoots: [LAYOUT.mountain],
    playerStart: MAPS.mountain.playerStart,
  },
};
