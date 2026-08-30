import * as THREE from "three";
import type { ToolId } from "./tool-catalog";

const wood = () => new THREE.MeshStandardMaterial({ color: 0x8b5a34, flatShading: true });
const metal = () => new THREE.MeshStandardMaterial({ color: 0xaab3b6, roughness: 0.55, metalness: 0.45, flatShading: true });
const darkMetal = () => new THREE.MeshStandardMaterial({ color: 0x596368, roughness: 0.5, metalness: 0.55, flatShading: true });
const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Mesh(geometry, material);
const handle = (length = 1.3, radius = 0.075) => mesh(new THREE.CylinderGeometry(radius, radius * 1.08, length, 8), wood());

function makeAxe() {
  const group = new THREE.Group();
  const shaft = handle(1.45);
  const head = mesh(new THREE.BoxGeometry(0.58, 0.3, 0.16), darkMetal());
  head.position.y = 0.62;
  head.rotation.z = -0.12;
  group.add(shaft, head);
  return group;
}
function makeSickle() {
  const group = new THREE.Group();
  const shaft = handle(0.75, 0.065);
  shaft.position.y = -0.35;
  const blade = mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 18, Math.PI * 1.35), metal());
  blade.position.set(0.28, 0.2, 0);
  blade.rotation.z = -0.2;
  group.add(shaft, blade);
  return group;
}
function makeHoe() {
  const group = new THREE.Group();
  const shaft = handle(1.5);
  const head = mesh(new THREE.BoxGeometry(0.62, 0.12, 0.24), darkMetal());
  head.position.set(0.2, 0.7, 0);
  head.rotation.z = -0.18;
  group.add(shaft, head);
  return group;
}
function makeWateringCan() {
  const group = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.58, 10), new THREE.MeshStandardMaterial({ color: 0x668f91, flatShading: true }));
  const spout = mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.75, 8), metal());
  spout.rotation.z = Math.PI / 2.8;
  spout.position.set(0.55, 0.12, 0);
  const rose = mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.12, 10), metal());
  rose.rotation.z = Math.PI / 2;
  rose.position.set(0.86, 0.38, 0);
  const grip = mesh(new THREE.TorusGeometry(0.36, 0.055, 6, 16, Math.PI), darkMetal());
  grip.rotation.x = Math.PI / 2;
  grip.position.y = 0.3;
  group.add(body, spout, rose, grip);
  return group;
}
function makeFishingRod() {
  const group = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.025, 0.055, 1.65, 8), new THREE.MeshStandardMaterial({ color: 0x6c4b31, flatShading: true }));
  rod.rotation.z = -0.2;
  const reel = mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 12), darkMetal());
  reel.position.set(-0.1, -0.45, 0);
  reel.rotation.y = Math.PI / 2;
  group.add(rod, reel);
  return group;
}
function makeBrush() {
  const group = new THREE.Group();
  const back = mesh(new THREE.BoxGeometry(0.55, 0.2, 0.35), wood());
  const grip = handle(0.7, 0.07);
  grip.rotation.z = Math.PI / 2;
  grip.position.x = -0.5;
  const bristles = mesh(new THREE.BoxGeometry(0.48, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8c8a5, flatShading: true }));
  bristles.position.y = -0.18;
  group.add(back, grip, bristles);
  return group;
}
function makeMilker() {
  const group = new THREE.Group();
  const bucket = mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.62, 10), metal());
  const rim = mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 14), darkMetal());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.31;
  const grip = mesh(new THREE.TorusGeometry(0.31, 0.035, 6, 14, Math.PI), darkMetal());
  grip.position.y = 0.34;
  group.add(bucket, rim, grip);
  return group;
}
function makeShears() {
  const group = new THREE.Group();
  const bladeA = mesh(new THREE.BoxGeometry(0.72, 0.1, 0.12), metal());
  const bladeB = bladeA.clone();
  bladeA.position.x = 0.28;
  bladeB.position.x = 0.28;
  bladeA.rotation.z = 0.2;
  bladeB.rotation.z = -0.2;
  const ringA = mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 12), darkMetal());
  const ringB = ringA.clone();
  ringA.position.set(-0.28, 0.18, 0);
  ringB.position.set(-0.28, -0.18, 0);
  group.add(bladeA, bladeB, ringA, ringB);
  return group;
}

export function makeToolModel(toolId: ToolId): THREE.Object3D {
  switch (toolId) {
    case "wateringCan": return makeWateringCan();
    case "hoe": return makeHoe();
    case "sickle": return makeSickle();
    case "dualAxe": return makeAxe();
    case "fishingRod": return makeFishingRod();
    case "brush": return makeBrush();
    case "milker": return makeMilker();
    case "shears": return makeShears();
  }
}
