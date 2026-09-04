// 角色模型獨立預覽頁——debug-character.html 專用，不吃遊戲的 scene/
// game-state/save 系統，純粹開一顆最小 Three.js 場景把單一角色模型
// 擺出來，方便新角色(例如 makeMarineBiologist)做完之後不用真的跑整個
// 遊戲、找到對應 NPC 走到面前，就能直接看外觀。
// 只 import humanoid.ts(純函式、無副作用)，不 import game-state.ts 等
// 會綁 DOM/localStorage 的模組，兩邊完全獨立，不會互相影響。
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  makeMarineBiologist,
  makeMayor,
  makeCarpenter,
  makeCaptain,
  makeArtist,
  makeBotanist,
  makeMountainGuardian,
  makeGoddess,
  makeGuesthouseManager,
  makeDoctor,
  makeNurse,
  makeHeroPlayer,
  makeHumanoid,
  animateWalk,
  animateRun,
  animateSit,
  animateToolForward,
  animateToolOverhead,
} from "./humanoid";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2430);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.05,
  50,
);
camera.position.set(1.6, 1.1, 2.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff4dd, 1.05);
sun.position.set(2.2, 3.5, 1.8);
sun.castShadow = true;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdbe9ff, 0.35);
fill.position.set(-2, 1.5, -1.5);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 32),
  new THREE.MeshStandardMaterial({ color: 0x33403a, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(4, 16, 0x556, 0x445);
scene.add(grid);

let current: THREE.Object3D | null = null;
function loadCharacter(key: string) {
  if (current) {
    scene.remove(current);
    current = null;
  }
  const factory: Record<string, () => THREE.Object3D> = {
    marineBiologist: makeMarineBiologist,
    mayor: makeMayor,
    carpenter: makeCarpenter,
    captain: makeCaptain,
    artist: makeArtist,
    botanist: makeBotanist,
    mountainGuardian: makeMountainGuardian,
    goddess: makeGoddess,
    guesthouseManager: makeGuesthouseManager,
    doctor: makeDoctor,
    nurse: makeNurse,
    heroMale: () => makeHeroPlayer("male"),
    heroFemale: () => makeHeroPlayer("female"),
    humanoid: () => makeHumanoid({}),
  };
  const model = (factory[key] || makeMarineBiologist)();
  model.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      (obj as THREE.Mesh).castShadow = true;
      (obj as THREE.Mesh).receiveShadow = true;
    }
  });
  scene.add(model);
  current = model;
  // 換角色時姿勢/位置重置，不然殘留上一隻的坐下/跑步姿勢或位移。
  current.position.set(0, 0, 0);
  current.rotation.set(0, 0, 0);
  checkGroundContact(model);
}

// 2026-09-04 Zeppelin 反饋：植物學家/藝術家做出來時鞋子陷進地板下面
// (makeLeg 裡 pivot 高度跟 leg/boot/sole 疊起來的總深度沒對齊，鞋底沒有
// 精確停在 y=0)。這是純算術錯誤，肉眼在正常鏡頭角度下不一定看得出來
// (要蹲低或轉到特定角度才明顯)，光靠人工檢查不可靠，所以每次切換角色
// 都自動量一次目前姿勢下最低點的世界座標 Y，跟預期的地面(0)比對，量出
// 明顯落差就直接標紅字提醒，不用等截圖給 Zeppelin 才發現。
// 2026-09-04 補充：主角(男/女)一度誤報「鞋子陷進地下 0.070」，查出來
// 不是腿的問題——makeAdventurerHero() 右手掛了一根 visible=false 的釣竿
// (parts.rod，用於之後的釣魚動畫)，長度延伸到手掌下方 0.56 個單位。
// THREE.Box3().setFromObject() 預設不管 visible 旗標，照樣把隱藏物件的
// 幾何體算進包圍盒，於是這根「看不見」的竿子把最低點量歪了。改用
// traverseVisible()只收集看得見的 mesh，跟遊戲畫面實際渲染的結果一致；
// 這樣才不會把「隱藏道具」誤判成「鞋子沒站好」。
function checkGroundContact(model: THREE.Object3D) {
  const el = document.getElementById("groundCheck");
  if (!el) return;
  const box = new THREE.Box3();
  model.traverseVisible((obj) => {
    const mesh = obj as THREE.Mesh;
    if ((mesh as any).isMesh && mesh.geometry) {
      box.expandByObject(mesh);
    }
  });
  if (box.isEmpty()) return;
  const footY = box.min.y;
  const off = Math.abs(footY);
  if (off < 0.015) {
    el.textContent = `✓ 鞋底貼地 (最低點 y=${footY.toFixed(3)})`;
    el.style.color = "#7fd88f";
  } else if (footY < 0) {
    el.textContent = `⚠ 鞋子陷進地下 ${off.toFixed(3)} 個單位 (最低點 y=${footY.toFixed(3)})——去 makeLeg() 檢查 pivot 高度跟 leg/boot/sole 疊加總深度是否對得上`;
    el.style.color = "#ff8a80";
  } else {
    el.textContent = `⚠ 懸空 ${off.toFixed(3)} 個單位 (最低點 y=${footY.toFixed(3)})——去 makeLeg() 檢查同一件事`;
    el.style.color = "#ffcf6b";
  }
}

const select = document.getElementById("characterSelect") as HTMLSelectElement;
select.addEventListener("change", () => loadCharacter(select.value));
loadCharacter(select.value);

// 動作測試——沿用遊戲本身的 animateWalk/animateRun/animateSit，不是另外
// 兜一套；沒有 parts.legL/legR/armL/armR 的角色(目前所有低模都有)呼叫了
// 也只是靜靜不動，不會報錯。表情目前沒有對應系統，先不做按鈕(見頁面上
// 的說明文字)。
type AnimMode = "idle" | "walk" | "run" | "sit" | "toolForward" | "toolOverhead";
let animMode: AnimMode = "idle";
const animButtons = document.querySelectorAll<HTMLButtonElement>("#animButtons button[data-anim]");
animButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    animMode = btn.dataset.anim as AnimMode;
    animButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});
(document.querySelector('#animButtons button[data-anim="idle"]') as HTMLButtonElement)?.classList.add("active");

const autoRotateBox = document.getElementById("autoRotate") as HTMLInputElement;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  if (current) {
    if (autoRotateBox?.checked) current.rotation.y += 0.004; // 慢慢自轉，不用手動拖也看得到全身
    if (animMode === "walk") animateWalk(current, true, t);
    else if (animMode === "run") animateRun(current, true, t);
    else if (animMode === "sit") animateSit(current);
    else if (animMode === "toolForward") animateToolForward(current);
    else if (animMode === "toolOverhead") animateToolOverhead(current);
    else animateWalk(current, false, t); // 待機：沿用 walk 的「停下來」分支，手腳慢慢鬆回中立姿勢
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
