import { buildMap, loadMap, fadeIn } from "./build-map";
import { animate } from "./game-loop";

buildMap("livingArea");
loadMap("livingArea", undefined);
fadeIn();
requestAnimationFrame(animate);
