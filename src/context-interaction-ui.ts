import * as THREE from "three";
import { chooseInteractionTarget, promptFor, type ContextAction, type InteractionCandidate, type InteractionSlot } from "./context-interaction";
import { actionsForAnimal, getCarriedAnimalId } from "./animal-interactions";
import { gameState, cropState, inventory, WOOD_NODES, STONE_NODES } from "./game-state";
import { animals, npcs } from "./npc-runtime";
import { renderer, camera, scene } from "./scene-sky";
import { getGameplayCamera, isFirstPersonModeActive } from "./first-person-camera";
import { isCameraAdjustModeActive } from "./cutscene-camera";
import { isInventoryOpen } from "./inventory-ui";
import { activeChoice, dialogQueue } from "./dialogue";
import { getEffectiveControllerLayout, getLastInputDevice, markKeyboardMouseInput, onInputPresentationChanged } from "./input-device";
import { requestPlayerNavigation, findReachablePlayerDestination, cancelPlayerNavigation, onNavigationDestinationChanged } from "./player-navigation";
import { gatherNodeMeshes, fishingWaterMeshes } from "./scene-registries";
import { isNearFishingWater } from "./fishing-water";
import { showUiToast } from "./ui-toast";
import { farmGroup } from "./farm-visuals";
import { FARMLAND_TILES, POUCH_POS } from "./layout-maps";
import { cycleHeldItem, inventoryItem, itemAmount, stowHeldItem } from "./inventory-system";
import { cropTypeForSeedItem } from "./item-catalog";

type WorldTarget = {
  id: string; object: THREE.Object3D; radius: number; actions: ContextAction[];
  getPosition: () => { x: number; z: number } | null; isValid: () => boolean;
};
const INTERACTION_RADIUS=2.25, DRAG_THRESHOLD=9;
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let pointedId:string|null=null, selectedTarget:WorldTarget|null=null, currentTarget:WorldTarget|null=null, currentActions:ContextAction[]=[];
let root:HTMLElement|null=null, bypassLegacy=false, down:{x:number;y:number;pointerId:number}|null=null;
const activePointers = new Set<number>();
const destinationMarker=new THREE.Mesh(new THREE.RingGeometry(0.14,0.22,24),new THREE.MeshBasicMaterial({color:0xffd45a,side:THREE.DoubleSide,transparent:true,opacity:0.9}));
destinationMarker.rotation.x=-Math.PI/2; destinationMarker.visible=false; scene.add(destinationMarker);
let markerTimer=0, highlight:THREE.BoxHelper|null=null, highlightTimer=0;

function blocked(allowActiveFishing=false){return !gameState.player || gameState.titlePresentationActive || gameState.cutsceneActive || isCameraAdjustModeActive() || isInventoryOpen() || dialogQueue.length>0 || Boolean(activeChoice) || (!allowActiveFishing&&gameState.fishingState!=="idle");}
function contains(root:THREE.Object3D,obj:THREE.Object3D){let current:THREE.Object3D|null=obj;while(current){if(current===root)return true;current=current.parent;}return false;}
function legacyAction(id:string,label:string):ContextAction{return{id,label,slot:"primary",execute:runLegacyPrimaryInteraction};}
function targetForAnimal(id:string):WorldTarget|null{const animal=animals.find(a=>a.id===id);if(!animal||!animal.mesh.visible)return null;return{id:"animal:"+id,object:animal.mesh,radius:1.35,actions:actionsForAnimal(id),getPosition:()=>animal.mesh.visible?{x:animal.mesh.position.x,z:animal.mesh.position.z}:null,isValid:()=>animal.mesh.visible&&actionsForAnimal(id).length>0};}
function targetForNpc(id:string):WorldTarget|null{const npc=npcs.find(n=>n.id===id);if(!npc||!npc.mesh.visible||npc.map!==gameState.currentMapName)return null;return{id:"npc:"+id,object:npc.mesh,radius:1.25,actions:[legacyAction("talk","\u5c0d\u8a71")],getPosition:()=>npc.mesh.visible?{x:npc.mesh.position.x,z:npc.mesh.position.z}:null,isValid:()=>npc.mesh.visible&&npc.map===gameState.currentMapName};}
function targetForGather(nodeId:string):WorldTarget|null{const entry=gatherNodeMeshes.find(e=>e.nodeId===nodeId&&e.map===gameState.currentMapName);const node=[...WOOD_NODES,...STONE_NODES].find(n=>n.id===nodeId);if(!entry||!node||node.collected)return null;return{id:"gather:"+nodeId,object:entry.group,radius:1.2,actions:[legacyAction(node.kind,node.kind==="wood"?"\u780d\u6a39":"\u63a1\u77f3")],getPosition:()=>node.collected?null:{x:node.x,z:node.z},isValid:()=>!node.collected&&entry.group.visible};}
function targetForFarm(x:number,z:number,object:THREE.Object3D=farmGroup):WorldTarget|null{
  if(gameState.currentMapName!=="livingArea")return null;
  if(x===POUCH_POS.x&&z===POUCH_POS.z&&gameState.currentDay>gameState.pouchCollectedDay)return{id:"pouch",object,radius:0.9,actions:[legacyAction("pickup","\u62fe\u53d6")],getPosition:()=>({x,z}),isValid:()=>gameState.currentDay>gameState.pouchCollectedDay};
  if(!FARMLAND_TILES.some(([fx,fz])=>fx===x&&fz===z))return null;
  const crop=cropState[`${x},${z}`];
  if(crop?.stage>=2)return{id:`crop:${x},${z}`,object,radius:0.8,actions:[legacyAction("harvest","\u6536\u6210")],getPosition:()=>({x,z}),isValid:()=>Boolean(cropState[`${x},${z}`]?.stage>=2)};
  const heldSeedId=inventory.heldItemId, heldCropType=cropTypeForSeedItem(heldSeedId);
  if(!crop&&heldSeedId&&heldCropType&&itemAmount(heldSeedId)>0)return{id:`soil:${x},${z}`,object,radius:0.8,actions:[legacyAction("plant","\u64ad\u7a2e")],getPosition:()=>({x,z}),isValid:()=>!cropState[`${x},${z}`]&&inventory.heldItemId===heldSeedId&&itemAmount(heldSeedId)>0};
  return null;
}
function allTargets(){
  const list:WorldTarget[]=[];
  if(getCarriedAnimalId()){const t=targetForAnimal(getCarriedAnimalId()!);if(t)list.push(t);return list;}
  if(gameState.currentMapName==="livingArea")animals.forEach(a=>{const t=targetForAnimal(a.id);if(t)list.push(t);});
  npcs.forEach(n=>{const t=targetForNpc(n.id);if(t)list.push(t);});
  gatherNodeMeshes.forEach(e=>{const t=targetForGather(e.nodeId);if(t)list.push(t);});
  FARMLAND_TILES.forEach(([x,z])=>{const t=targetForFarm(x,z);if(t)list.push(t);});
  const pouch=targetForFarm(POUCH_POS.x,POUCH_POS.z);if(pouch)list.push(pouch);
  return list;
}
function refreshSelectedTarget(target: WorldTarget) {
  if (target.id.startsWith("animal:")) return targetForAnimal(target.id.slice(7));
  if (target.id.startsWith("npc:")) return targetForNpc(target.id.slice(4));
  if (target.id.startsWith("gather:")) return targetForGather(target.id.slice(7));
  const position = target.getPosition();
  return position ? targetForFarm(Math.round(position.x), Math.round(position.z), target.object) : null;
}
function chooseTarget(){
  if(blocked())return null;
  if(selectedTarget) selectedTarget = refreshSelectedTarget(selectedTarget);
  if(selectedTarget?.isValid())return selectedTarget;
  selectedTarget=null;
  const rotation=gameState.player.rotation.y,fx=-Math.sin(rotation),fz=-Math.cos(rotation);
  const targets=allTargets();
  const candidates:InteractionCandidate[]=targets.map(t=>{const p=t.getPosition()!;const dx=p.x-gameState.player.position.x,dz=p.z-gameState.player.position.z,d=Math.hypot(dx,dz);return{id:t.id,distance:d,facingScore:d?((dx*fx+dz*fz)/d):1,pointed:t.id===pointedId,actions:t.actions};}).filter(t=>t.distance<=INTERACTION_RADIUS);
  const chosen=chooseInteractionTarget(candidates,currentTarget?.id||null);return chosen?targets.find(t=>t.id===chosen.id)||null:null;
}
function ensureRoot(){if(root)return root;root=document.createElement("div");root.id="contextInteractionHud";root.setAttribute("aria-live","polite");root.setAttribute("aria-label","\u60c5\u5883\u4e92\u52d5");document.body.append(root);return root;}
function render(){
  const box=ensureRoot(); currentTarget=chooseTarget(); currentActions=currentTarget?.actions||[];
  const heldId=inventory.heldItemId, held=heldId?inventoryItem(heldId):undefined;
  const layout=getEffectiveControllerLayout(), device=getLastInputDevice();
  const sig=(currentTarget?.id||"")+"|"+currentActions.map(a=>a.id+promptFor(a.slot,device,layout)).join("|")+`|held:${heldId||""}:${heldId?itemAmount(heldId):0}:${device}:${layout}`;
  box.classList.toggle("visible",currentActions.length>0||Boolean(held)); if(box.dataset.signature===sig)return; box.dataset.signature=sig; box.replaceChildren();
  const appendPrompt=(key:string,label:string,onClick?:()=>void)=>{const button=document.createElement("button");button.type="button";button.className="contextInteractionAction";const kbd=document.createElement("kbd"),text=document.createElement("span");kbd.textContent=key;text.textContent=label;button.append(kbd,text);if(onClick)button.addEventListener("click",event=>{event.stopPropagation();onClick();});else button.disabled=true;box.append(button);};
  currentActions.forEach(action=>{appendPrompt(promptFor(action.slot,device,layout),action.label,()=>{markKeyboardMouseInput(new Event("pointerdown"));executeContextInteraction(action.slot);});});
  if(held){appendPrompt(device==="gamepad"?"LB/RB":"滾輪","切換物品",()=>cycleHeldItem(1));appendPrompt("右鍵","收回",stowHeldItem);}
}
function updateRay(clientX:number,clientY:number){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((clientX-rect.left)/rect.width)*2-1;pointer.y=-((clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,getGameplayCamera(camera));}
function targetFromRay(){
  const targets=allTargets(),objects=targets.map(t=>t.object),hit=objects.length?raycaster.intersectObjects(objects,true)[0]:null;
  if(hit){const target=targets.find(t=>contains(t.object,hit.object));if(target?.id.startsWith("soil:")||target?.id.startsWith("crop:")||target?.id==="pouch"){const x=Math.round(hit.point.x),z=Math.round(hit.point.z);return targetForFarm(x,z,hit.object)||target;}return target||null;}
  return null;
}
function waterHitFromRay(){
  const hit=fishingWaterMeshes.length?raycaster.intersectObjects(fishingWaterMeshes,true)[0]:null;
  if(!hit)return null;
  const water=fishingWaterMeshes.find(mesh=>contains(mesh,hit.object));
  return water?{water,point:{x:hit.point.x,z:hit.point.z}}:null;
}
function approachWater(water:THREE.Object3D,point:{x:number;z:number}){
  const shore=findReachablePlayerDestination(point);
  if(!shore||!isNearFishingWater(gameState.currentMapName,shore.x,shore.z)){showUiToast("無法釣魚","無法走到可釣魚的岸邊。");return false;}
  const execute=()=>{const dx=point.x-gameState.player.position.x,dz=point.z-gameState.player.position.z;gameState.player.rotation.y=Math.atan2(-dx,-dz);runLegacyPrimaryInteraction();};
  if(Math.hypot(shore.x-gameState.player.position.x,shore.z-gameState.player.position.z)<=0.35){execute();return true;}
  return requestPlayerNavigation(shore,{id:"fishing-water",radius:0.35,getPosition:()=>shore,isValid:()=>fishingWaterMeshes.includes(water)&&Boolean(water.parent),execute});
}
function showHighlight(target:WorldTarget){if(highlight){scene.remove(highlight);highlight.geometry.dispose(); (highlight.material as THREE.Material).dispose();}highlight=new THREE.BoxHelper(target.object,0xffd45a);scene.add(highlight);highlightTimer=performance.now()+850;}
function approach(target:WorldTarget,action:ContextAction){const p=target.getPosition();if(!p)return false;selectedTarget=target;showHighlight(target);const dx=p.x-gameState.player.position.x,dz=p.z-gameState.player.position.z;if(Math.hypot(dx,dz)<=target.radius+0.2){gameState.player.rotation.y=Math.atan2(-dx,-dz);action.execute();selectedTarget=null;return true;}return requestPlayerNavigation(p,{id:target.id,radius:target.radius,getPosition:target.getPosition,isValid:()=>target.isValid()&&target.actions.some(a=>a.id===action.id),execute:()=>{if(target.isValid()){action.execute();selectedTarget=null;}}});}
export function executeContextInteraction(slot:InteractionSlot){currentTarget=chooseTarget();const action=currentTarget?.actions.find(a=>a.slot===slot);if(!currentTarget||!action)return false;return approach(currentTarget,action);}
function dispatchPrimaryInteraction(){window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}));}
export function runLegacyPrimaryInteraction(){bypassLegacy=true;dispatchPrimaryInteraction();}
export function consumeLegacyPrimaryBypass(){const value=bypassLegacy;bypassLegacy=false;return value;}
export function refreshShortcutLabels(){const layout=getEffectiveControllerLayout(),info=document.querySelector<HTMLElement>("#quickInfoMenuBtn small"),map=document.querySelector<HTMLElement>("#quickMapMenuBtn small");if(info)info.textContent=layout==="nintendo"?"Q / -":"Q / View";if(map)map.textContent="M / L3";if(root)root.dataset.signature="";}
function handleWorldClick(clientX:number,clientY:number){if(isFirstPersonModeActive()){if(!blocked(true))dispatchPrimaryInteraction();return;}if(blocked())return;updateRay(clientX,clientY);const target=targetFromRay();if(target){selectedTarget=target;pointedId=target.id;approach(target,target.actions[0]);return;}const waterHit=waterHitFromRay();if(waterHit){selectedTarget=null;approachWater(waterHit.water,waterHit.point);return;}groundPlane.constant=-gameState.player.position.y;const hit=new THREE.Vector3();if(raycaster.ray.intersectPlane(groundPlane,hit)){selectedTarget=null;requestPlayerNavigation({x:hit.x,z:hit.z});}}
function frame(){if(highlight&&performance.now()>highlightTimer){scene.remove(highlight);highlight.geometry.dispose(); (highlight.material as THREE.Material).dispose();highlight=null;}if(destinationMarker.visible&&performance.now()>markerTimer)destinationMarker.visible=false;render();requestAnimationFrame(frame);}
export function initContextInteraction(){
  ensureRoot();refreshShortcutLabels();onInputPresentationChanged(refreshShortcutLabels);addEventListener("controller-layout-changed",refreshShortcutLabels);addEventListener("keydown",markKeyboardMouseInput);addEventListener("pointerdown",markKeyboardMouseInput);
  renderer.domElement.addEventListener("pointermove",event=>{if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)>DRAG_THRESHOLD)return;updateRay(event.clientX,event.clientY);pointedId=targetFromRay()?.id||null;});
  renderer.domElement.addEventListener("pointerdown",event=>{ activePointers.add(event.pointerId); if(activePointers.size>1){down=null;return;} if(event.button!==0)return; if(isFirstPersonModeActive()){down=null;if(!blocked(true))dispatchPrimaryInteraction();return;} if(blocked())return; down={x:event.clientX,y:event.clientY,pointerId:event.pointerId}; });
  renderer.domElement.addEventListener("pointerup",event=>{ activePointers.delete(event.pointerId); if(!down||event.pointerId!==down.pointerId)return; const start=down;down=null; if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>DRAG_THRESHOLD)return; handleWorldClick(event.clientX,event.clientY); });
  renderer.domElement.addEventListener("pointercancel",event=>{activePointers.delete(event.pointerId);down=null;});renderer.domElement.addEventListener("pointerleave",()=>{pointedId=null;});
  onNavigationDestinationChanged(destination=>{if(!destination){destinationMarker.visible=false;return;}destinationMarker.position.set(destination.x,gameState.player?.position.y+0.04||0.04,destination.z);destinationMarker.visible=true;markerTimer=performance.now()+1400;});
  addEventListener("keydown",event=>{if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(event.key.toLowerCase())){selectedTarget=null;cancelPlayerNavigation();}});
  requestAnimationFrame(frame);
}
