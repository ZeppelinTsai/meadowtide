import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  markRuntimePlayerMesh,
  removeStalePlayerMeshes,
} from "./player-mesh-lifecycle";

test("save loading keeps only the active player mesh and preserves NPCs", () => {
  const scene = new THREE.Scene();
  const active = markRuntimePlayerMesh(new THREE.Group());
  const stale = markRuntimePlayerMesh(new THREE.Group());
  const legacyStale = new THREE.Group();
  legacyStale.userData.playerAppearance = "female";
  const npc = new THREE.Group();
  scene.add(active, stale, legacyStale, npc);

  assert.equal(removeStalePlayerMeshes(scene, active), 2);
  assert.deepEqual(scene.children, [active, npc]);
});
