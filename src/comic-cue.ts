import * as THREE from "three";
import { gameState } from "./game-state";
import { npcs } from "./npc-runtime";
import {
  shouldDisplayDialogText,
  type ComicCueKind,
  type ComicCueSpec,
} from "./comic-cue-logic";
import { playRandomSfx, COMIC_CUE_SFX } from "./sfx";

export type { ComicCueKind, ComicCueSpec } from "./comic-cue-logic";

let activeCue: THREE.Sprite | null = null;

export { shouldDisplayDialogText } from "./comic-cue-logic";

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
  // 音效跟視覺分格符號綁在一起觸發，畫面沒真的顯示(找不到 actor)就不
  // 該憑空響一聲，所以擺在上面那個 return 之後。
  playRandomSfx(COMIC_CUE_SFX[spec.kind]);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: cueTexture(spec.kind),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const baseScale = 1.5;
  // Humanoids are about 1 world unit tall. Keep the sprite's centre far enough
  // above the head that the full comic bubble never overlaps the actor.
  const baseY = actor.position.y + 1.9;
  const startAt = performance.now();
  const isReverseBounce = spec.kind === "sweatFace";
  sprite.renderOrder = 1000;
  sprite.scale.set(baseScale, baseScale, 1);
  sprite.position.copy(actor.position);
  sprite.position.y = baseY + (isReverseBounce ? 0.4 : 0);
  actor.parent.add(sprite);
  activeCue = sprite;

  const tick = () => {
    if (!activeCue || activeCue !== sprite) return;
    const elapsed = (performance.now() - startAt) / 1000;
    const bouncePhase = Math.sin(elapsed * 9.5);
    const lift = Math.abs(bouncePhase) * 0.6;
    const travel = isReverseBounce ? -bouncePhase * 0.32 : Math.abs(bouncePhase) * 0.18;
    sprite.position.y = baseY + (isReverseBounce ? 0.55 - lift * 0.8 : 0) + travel;
    const pulse = baseScale * (1 + Math.abs(Math.sin(elapsed * 9.5)) * 0.2);
    sprite.scale.set(pulse, pulse, 1);
    if (elapsed < 1.4) {
      requestAnimationFrame(tick);
    } else {
      clearComicCue();
    }
  };
  requestAnimationFrame(tick);
}