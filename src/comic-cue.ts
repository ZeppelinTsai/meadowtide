import * as THREE from "three";
import { gameState } from "./game-state";
import { npcs } from "./npc-runtime";

export type ComicCueKind = "!" | "?" | "..." | "panicDrops" | "sweatFace" | "gloom";
export interface ComicCueSpec {
  actorId: "player" | string;
  kind: ComicCueKind;
}

let activeCue: THREE.Sprite | null = null;

export function clearComicCue() {
  if (!activeCue) return;
  activeCue.parent?.remove(activeCue);
  activeCue.material.map?.dispose();
  activeCue.material.dispose();
  activeCue = null;
}

function roundedBubble(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.roundRect(30, 20, 196, 148, 34);
  ctx.moveTo(116, 168);
  ctx.lineTo(98, 205);
  ctx.lineTo(142, 168);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 247, 221, 0.96)";
  ctx.strokeStyle = "#5a3b27";
  ctx.lineWidth = 10;
  ctx.fill();
  ctx.stroke();
}

function drawDrop(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.bezierCurveTo(25, -3, 26, 20, 0, 30);
  ctx.bezierCurveTo(-26, 20, -25, -3, 0, -34);
  ctx.fillStyle = "#75c8e8";
  ctx.strokeStyle = "#3e6f82";
  ctx.lineWidth = 6;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function cueTexture(kind: ComicCueKind) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (kind === "!" || kind === "?" || kind === "...") {
    roundedBubble(ctx);
    ctx.fillStyle = "#5a3b27";
    ctx.font = `900 ${kind === "..." ? 92 : 116}px sans-serif`;
    ctx.fillText(kind === "..." ? "…" : kind, 128, 92);
  } else if (kind === "panicDrops") {
    drawDrop(ctx, 70, 105, 0.9);
    drawDrop(ctx, 128, 63, 0.72);
    drawDrop(ctx, 186, 112, 1);
  } else if (kind === "sweatFace") {
    ctx.beginPath();
    ctx.arc(118, 120, 70, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 239, 191, 0.96)";
    ctx.strokeStyle = "#5a3b27";
    ctx.lineWidth = 9;
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#5a3b27";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(78, 103);
    ctx.lineTo(98, 113);
    ctx.moveTo(158, 103);
    ctx.lineTo(138, 113);
    ctx.moveTo(88, 151);
    ctx.quadraticCurveTo(118, 132, 150, 151);
    ctx.stroke();
    drawDrop(ctx, 199, 68, 0.85);
  } else {
    ctx.fillStyle = "#5a3b27";
    ctx.font = "900 126px sans-serif";
    ctx.fillText("|||", 128, 112);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function showComicCue(spec?: ComicCueSpec | null) {
  clearComicCue();
  if (!spec) return;
  const actor = spec.actorId === "player"
    ? gameState.player
    : npcs.find((npc) => npc.id === spec.actorId)?.mesh;
  if (!actor?.parent) return;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cueTexture(spec.kind),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.renderOrder = 1000;
  sprite.scale.set(1.15, 1.15, 1);
  sprite.position.copy(actor.position);
  sprite.position.y += 1.48;
  actor.parent.add(sprite);
  activeCue = sprite;
}