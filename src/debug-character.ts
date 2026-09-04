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
  makeHumanoid,
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
}

const select = document.getElementById("characterSelect") as HTMLSelectElement;
select.addEventListener("change", () => loadCharacter(select.value));
loadCharacter(select.value);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  if (current) current.rotation.y += 0.004; // 慢慢自轉，不用手動拖也看得到全身
  controls.update();
  renderer.render(scene, camera);
}
animate();
