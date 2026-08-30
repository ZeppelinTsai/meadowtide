import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { TOOL_DEFINITIONS } from "./tool-catalog";
import { makeToolModel } from "./tool-models";

test("八種工具都有可渲染且具尺寸的模型", () => {
  assert.equal(TOOL_DEFINITIONS.length, 8);
  TOOL_DEFINITIONS.forEach((tool) => {
    const model = makeToolModel(tool.id);
    const size = new THREE.Box3()
      .setFromObject(model)
      .getSize(new THREE.Vector3());
    assert.ok(size.x > 0 && size.y > 0 && size.z > 0, tool.label);
  });
});
