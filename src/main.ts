import { buildMap, loadMap, fadeIn } from "./build-map";
import { animate } from "./game-loop";
import { gameState } from "./game-state";
import { camera, scene } from "./scene-sky";

buildMap("livingArea");
loadMap("livingArea", undefined);
fadeIn();
requestAnimationFrame(animate);

// TEMP DIAGNOSTIC — remove before committing.
(window as any).__debug = { loadMap, gameState, camera, scene, buildMap };
