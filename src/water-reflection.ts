import * as THREE from "three";
import { renderer, scene } from "./scene-sky";
import { waterSurfaceMaterials } from "./scene-registries";
import { gameState } from "./game-state";
import { npcGroup, animalGroup } from "./npc-runtime";
import { weatherEffectGroup } from "./weather-particles";

const WATER_PLANE_Y = 0.1;
const REFLECTION_WIDTH = 1024;
const REFLECTION_HEIGHT = 576;
const renderTarget = new THREE.WebGLRenderTarget(
  REFLECTION_WIDTH,
  REFLECTION_HEIGHT,
  {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
  },
);
renderTarget.texture.generateMipmaps = false;

const textureMatrix = new THREE.Matrix4();
const reflectionMapUniform = { value: renderTarget.texture };
const textureMatrixUniform = { value: textureMatrix };

type ReflectiveWaterMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshBasicMaterial;
const installedMaterials = new WeakSet<ReflectiveWaterMaterial>();
let virtualCamera: THREE.Camera | null = null;
let virtualCameraType = "";

const planePoint = new THREE.Vector3(0, WATER_PLANE_Y, 0);
const planeNormal = new THREE.Vector3(0, 1, 0);
const cameraWorldPosition = new THREE.Vector3();
const rotationMatrix = new THREE.Matrix4();
const lookAtPosition = new THREE.Vector3();
const view = new THREE.Vector3();
const target = new THREE.Vector3();
const reflectorPlane = new THREE.Plane();
const clipPlane = new THREE.Vector4();
const q = new THREE.Vector4();

function installReflection(material: ReflectiveWaterMaterial) {
  if (installedMaterials.has(material)) return;
  installedMaterials.add(material);
  const previousCompile = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, rendererInstance) => {
    previousCompile(shader, rendererInstance);
    shader.uniforms.planarReflectionMap = reflectionMapUniform;
    shader.uniforms.planarReflectionMatrix = textureMatrixUniform;
    shader.uniforms.planarReflectionStrength = {
      value: THREE.MathUtils.lerp(0.42, 0.62, material.opacity),
    };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform mat4 planarReflectionMatrix;
varying vec4 vPlanarReflectionCoord;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
vec4 planarWorldPosition = worldPosition;
planarWorldPosition.y = ${WATER_PLANE_Y.toFixed(3)};
vPlanarReflectionCoord = planarReflectionMatrix * planarWorldPosition;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D planarReflectionMap;
uniform float planarReflectionStrength;
varying vec4 vPlanarReflectionCoord;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `vec3 planarReflection = texture2DProj(
  planarReflectionMap,
  vPlanarReflectionCoord
).rgb;
gl_FragColor.rgb = mix(
  gl_FragColor.rgb,
  planarReflection,
  planarReflectionStrength
);
#include <dithering_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "meadowtide-planar-water-v1";
  material.needsUpdate = true;
}

function ensureVirtualCamera(source: THREE.Camera) {
  if (!virtualCamera || virtualCameraType !== source.type) {
    virtualCamera = source.clone();
    virtualCameraType = source.type;
  }
  return virtualCamera;
}

function updateMirrorCamera(source: THREE.Camera) {
  source.updateMatrixWorld();
  const mirror = ensureVirtualCamera(source);
  cameraWorldPosition.setFromMatrixPosition(source.matrixWorld);
  rotationMatrix.extractRotation(source.matrixWorld);

  view
    .subVectors(planePoint, cameraWorldPosition)
    .reflect(planeNormal)
    .negate()
    .add(planePoint);
  lookAtPosition
    .set(0, 0, -1)
    .applyMatrix4(rotationMatrix)
    .add(cameraWorldPosition);
  target
    .subVectors(planePoint, lookAtPosition)
    .reflect(planeNormal)
    .negate()
    .add(planePoint);

  mirror.position.copy(view);
  mirror.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(planeNormal);
  mirror.lookAt(target);
  mirror.updateMatrixWorld();
  mirror.projectionMatrix.copy(source.projectionMatrix);

  textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  textureMatrix.multiply(mirror.projectionMatrix);
  textureMatrix.multiply(mirror.matrixWorldInverse);

  // Oblique near-plane clipping keeps geometry below the XZ water plane out
  // of the mirrored render, applicable to perspective cameras.
  if ((source as THREE.PerspectiveCamera).isPerspectiveCamera) {
    reflectorPlane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
    reflectorPlane.applyMatrix4(mirror.matrixWorldInverse);
    clipPlane.set(
      reflectorPlane.normal.x,
      reflectorPlane.normal.y,
      reflectorPlane.normal.z,
      reflectorPlane.constant,
    );
    const projection = mirror.projectionMatrix;
    q.x =
      (Math.sign(clipPlane.x) + projection.elements[8]) /
      projection.elements[0];
    q.y =
      (Math.sign(clipPlane.y) + projection.elements[9]) /
      projection.elements[5];
    q.z = -1;
    q.w = (1 + projection.elements[10]) / projection.elements[14];
    clipPlane.multiplyScalar(2 / clipPlane.dot(q));
    projection.elements[2] = clipPlane.x;
    projection.elements[6] = clipPlane.y;
    projection.elements[10] = clipPlane.z + 0.997;
    projection.elements[14] = clipPlane.w;
  }
  return mirror;
}

export function updatePlanarWaterReflection(
  activeCamera: THREE.Camera,
  frame: number,
) {
  waterSurfaceMaterials.forEach(installReflection);
  if (!waterSurfaceMaterials.length || frame % 2 !== 0) return;

  const mirror = updateMirrorCamera(activeCamera);
  const hidden: Array<{ object: THREE.Object3D; visible: boolean }> = [];

  // Hide ground, buildings, characters, animals, and transient weather particles
  // during the reflection pass so only the sky dome, stars, clouds, and celestial
  // atmosphere remain reflected. This deliberately excludes spring petals,
  // autumn leaves, snow, and other airborne effects that look noisy and expensive
  // when they are mirrored onto lakes and seas.
  const reflectionExcludeGroups = [
    gameState.mapGroup,
    npcGroup,
    animalGroup,
    gameState.player,
    weatherEffectGroup,
  ].filter(Boolean) as THREE.Object3D[];

  reflectionExcludeGroups.forEach((group) => {
    hidden.push({ object: group, visible: group.visible });
    group.visible = false;
  });

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    if (
      !materials.some((material) =>
        waterSurfaceMaterials.includes(material as ReflectiveWaterMaterial),
      )
    )
      return;
    hidden.push({ object, visible: object.visible });
    object.visible = false;
  });

  const currentTarget = renderer.getRenderTarget();
  const xrEnabled = renderer.xr.enabled;
  const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
  try {
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderTarget.texture.encoding = renderer.outputEncoding;
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, mirror);
  } finally {
    renderer.setRenderTarget(currentTarget);
    renderer.xr.enabled = xrEnabled;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
    hidden.forEach(({ object, visible }) => {
      object.visible = visible;
    });
  }
}
