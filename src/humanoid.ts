import * as THREE from "three";
import { HELD_ARM_ROTATION } from "./held-item-pose";

// 人形角色從鞋底到最高髮梢的統一世界高度；以村長專用模型為基準。
export const HUMANOID_WORLD_HEIGHT = 1;
const humanoidScale = (unscaledHeight) => HUMANOID_WORLD_HEIGHT / unscaledHeight;

// 人形角色的固定預設微笑：兩條短斜線形成淺弧，避免半圓 Torus 在俯視鏡頭下
// 變成厚重的大嘴。角色只調整整張臉的 Y/Z 落點，不改線段比例與角度。
export function addDefaultHumanoidSmile(
  group: THREE.Group,
  y: number,
  z: number,
  color = 0x854b3c,
) {
  const mouthMat = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
  });
  for (const side of [-1, 1]) {
    const smileSide = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.045, 5),
      mouthMat,
    );
    smileSide.position.set(side * 0.021, y, z);
    smileSide.rotation.z = side * -1.2;
    group.add(smileSide);
  }
}

// 6) 低模人形
      // ==============================================================
      export function makeHumanoid({
        skin = 0xffd6a5,
        shirt = 0x4f7cff,
        hair = 0x3a2a1e,
      }) {
        const group: any = new THREE.Group();
        const parts: any = {};
        const bodyMat = new THREE.MeshStandardMaterial({ color: shirt });
        const skinMat = new THREE.MeshStandardMaterial({ color: skin });
        const hairMat = new THREE.MeshStandardMaterial({ color: hair });
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.22, 0.42, 8),
          bodyMat,
        );
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 10, 8),
          skinMat,
        );
        head.position.y = 0.76;
        head.castShadow = true;
        group.add(head);
        const hairMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.21, 10, 8),
          hairMat,
        );
        hairMesh.scale.set(1, 0.6, 1.05);
        hairMesh.position.set(0, 0.86, -0.02);
        group.add(hairMesh);
        const nose = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, 0.07, 6),
          skinMat,
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.75, -0.2);
        group.add(nose);
        // 手/腳都用「肩膀/髖部支點群組 + 往下掛的圓柱」，而不是直接轉圓柱本身。
        // 圓柱自己當支點的話，轉軸在手臂中間，甩起來像斷手漂浮；
        // 現在轉軸在肩膀，圓柱整條從支點垂下去，才會是「從肩膀擺動」的感覺
        function makeArm(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.24, 0.58, 0); // 肩膀位置，貼著身體上緣
          const shoulder = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 6),
            skinMat,
          );
          pivot.add(shoulder);
          const armLen = 0.32;
          const arm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, armLen, 6),
            skinMat,
          );
          arm.position.y = -armLen / 2; // 讓圓柱從支點往下垂，而不是支點在圓柱中心
          arm.castShadow = true;
          pivot.add(arm);
          group.add(pivot);
          return pivot; // 動畫要轉的是這個支點群組，不是裡面的圓柱
        }
        parts.armL = makeArm(-1);
        parts.armR = makeArm(1);
        function makeLeg(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.1, 0.3, 0); // 髖部位置
          const legLen = 0.3;
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, legLen, 6),
            bodyMat,
          );
          leg.position.y = -legLen / 2;
          leg.castShadow = true;
          pivot.add(leg);
          group.add(pivot);
          return pivot;
        }
        parts.legL = makeLeg(-1);
        parts.legR = makeLeg(1);
        group.parts = parts;
        group.scale.setScalar(humanoidScale(0.986));
        return group;
      }

      // 村長專用低多邊形模型。面朝本地 -Z，parts 結構維持與一般 NPC 相同，
      // 讓既有的移動、轉向與走路動畫可以直接沿用。
      export function makeMayor() {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) =>
          new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xc9824f);
        const hairMat = mat(0x39332f);
        const jacketMat = mat(0x243b5a);
        const blouseMat = mat(0xd9c69a);
        const skirtMat = mat(0x563642);
        const sashMat = mat(0x294b49);
        const leatherMat = mat(0x49301f);
        const brassMat = mat(0xb78435);

        const skirt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.3, 0.48, 8),
          skirtMat,
        );
        skirt.position.y = 0.29;
        skirt.castShadow = true;
        group.add(skirt);

        const torso = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.23, 0.38, 8),
          blouseMat,
        );
        torso.position.y = 0.65;
        torso.castShadow = true;
        group.add(torso);

        // 敞開的深藍外套以左右兩片呈現，保留中央米色上衣。
        for (const side of [-1, 1]) {
          const jacket = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.48, 0.12),
            jacketMat,
          );
          jacket.position.set(side * 0.135, 0.59, 0.015);
          jacket.rotation.z = side * -0.07;
          jacket.castShadow = true;
          group.add(jacket);
          const lapel = new THREE.Mesh(
            new THREE.ConeGeometry(0.075, 0.25, 3),
            jacketMat,
          );
          lapel.position.set(side * 0.085, 0.75, -0.075);
          lapel.rotation.z = side * 0.35;
          group.add(lapel);
        }

        const sash = new THREE.Mesh(
          new THREE.CylinderGeometry(0.235, 0.235, 0.09, 8),
          sashMat,
        );
        sash.position.y = 0.47;
        group.add(sash);
        const knot = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), sashMat);
        knot.position.set(0, 0.46, -0.23);
        group.add(knot);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 10, 8),
          skinMat,
        );
        head.scale.set(0.96, 1.08, 0.94);
        head.position.y = 1.01;
        head.castShadow = true;
        group.add(head);

        const hairCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 9, 7),
          hairMat,
        );
        hairCap.scale.set(1.03, 0.68, 1.04);
        hairCap.position.set(0, 1.125, 0.015);
        group.add(hairCap);
        const bun = new THREE.Mesh(new THREE.DodecahedronGeometry(0.135, 0), hairMat);
        bun.scale.set(1.05, 0.85, 0.9);
        bun.position.set(-0.13, 1.02, 0.15);
        group.add(bun);
        for (const side of [-1, 1]) {
          const temple = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 7, 5),
            hairMat,
          );
          temple.scale.set(0.75, 1.35, 0.7);
          temple.position.set(side * 0.17, 1.04, -0.015);
          group.add(temple);
          const earring = new THREE.Mesh(
            new THREE.TorusGeometry(0.025, 0.009, 5, 8),
            brassMat,
          );
          earring.position.set(side * 0.205, 0.99, -0.045);
          earring.rotation.y = Math.PI / 2;
          group.add(earring);
        }

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.06, 5), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.995, -0.2);
        group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0x2b211b));
          eye.scale.set(1, 0.65, 0.35);
          eye.position.set(side * 0.075, 1.035, -0.19);
          group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.012), hairMat);
          brow.position.set(side * 0.075, 1.085, -0.195);
          brow.rotation.z = side * -0.12;
          group.add(brow);
        }
        // 兩段細線構成微笑；避免 Torus 半環在俯視鏡頭下看成誇張的大圓嘴。
        const mouthMat = mat(0x6f3a32);
        for (const side of [-1, 1]) {
          const smileSide = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.052, 5),
            mouthMat,
          );
          smileSide.position.set(side * 0.024, 0.95, -0.201);
          smileSide.rotation.z = side * -1.2;
          group.add(smileSide);
        }

        const brooch = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 5), mat(0xe6c27a));
        brooch.scale.set(1, 0.75, 0.3);
        brooch.position.set(-0.14, 0.76, -0.135);
        group.add(brooch);

        function makeArm(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.255, 0.79, 0);
          const sleeve = new THREE.Mesh(
            new THREE.CylinderGeometry(0.065, 0.055, 0.31, 7),
            jacketMat,
          );
          sleeve.position.y = -0.145;
          sleeve.castShadow = true;
          pivot.add(sleeve);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), skinMat);
          hand.scale.set(0.85, 1.05, 0.8);
          hand.position.y = -0.32;
          pivot.add(hand);
          group.add(pivot);
          return pivot;
        }
        parts.armL = makeArm(-1);
        parts.armR = makeArm(1);

        // 裙下的腿與靴子仍掛在髖部支點，避免走路動畫像漂浮斷肢。
        function makeLeg(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.105, 0.24, 0.02);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 6), skirtMat);
          leg.position.y = -0.1;
          pivot.add(leg);
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.2), leatherMat);
          boot.position.set(0, -0.19, -0.035);
          boot.castShadow = true;
          pivot.add(boot);
          group.add(pivot);
          return pivot;
        }
        parts.legL = makeLeg(-1);
        parts.legR = makeLeg(1);

        const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 9), brassMat);
        keyRing.position.set(-0.18, 0.42, -0.08);
        group.add(keyRing);
        for (let i = 0; i < 3; i++) {
          const key = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.012), brassMat);
          key.position.set(-0.22 + i * 0.04, 0.32 - i * 0.015, -0.08);
          key.rotation.z = (i - 1) * 0.18;
          group.add(key);
        }

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.275));
        return group;
      }

      // 可愛女孩角色 — parts 結構(armL/armR/legL/legR)跟 makeHumanoid 完全一致，
      // 所以 animateWalk() / FACING_ANGLE 那套邏輯不用改一行，純粹是外觀差異
      export function makeCarpenter() {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xc77b49), hairMat = mat(0x65351f);
        const jacketMat = mat(0x294f48), jacketEdgeMat = mat(0x416b5f);
        const shirtMat = mat(0xead9b8);
        const trouserMat = mat(0xa64f25), patchMat = mat(0x765137);
        const leatherMat = mat(0x56351f), bootMat = mat(0x3a2a20);
        const soleMat = mat(0x211b17), brassMat = mat(0xb27b2d);
        const woodMat = mat(0x6a4228), metalMat = mat(0x5d6260);

        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.215, 0.18, 8), trouserMat);
        pelvis.position.y = 0.48; group.add(pelvis);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 8), shirtMat);
        torso.position.y = 0.76; torso.castShadow = true; group.add(torso);

        for (const side of [-1, 1]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.105), jacketMat);
          panel.position.set(side * 0.13, 0.74, 0.015); panel.rotation.z = side * -0.045;
          panel.castShadow = true; group.add(panel);
          const lapel = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 3), jacketMat);
          lapel.position.set(side * 0.085, 0.91, -0.075); lapel.rotation.z = side * 0.38;
          group.add(lapel);
          const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.025), jacketEdgeMat);
          pocket.position.set(side * 0.125, 0.75, -0.115); group.add(pocket);
          const flap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.032), jacketMat);
          flap.position.set(side * 0.125, 0.815, -0.126); flap.rotation.z = side * -0.05;
          group.add(flap);
          const pocketButton = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), brassMat);
          pocketButton.position.set(side * 0.125, 0.803, -0.147); group.add(pocketButton);
        }
        const shirtPlacket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.31, 0.018), mat(0xf3e6ca));
        shirtPlacket.position.set(0, 0.77, -0.207); group.add(shirtPlacket);
        for (let i = 0; i < 3; i++) {
          const shirtButton = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), leatherMat);
          shirtButton.position.set(0, 0.68 + i * 0.09, -0.221); group.add(shirtButton);
        }
        for (let i = 0; i < 3; i++) {
          const button = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 7), brassMat);
          button.rotation.x = Math.PI / 2; button.position.set(-0.125, 0.66 + i * 0.12, -0.055);
          group.add(button);
        }
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.075, 8), leatherMat);
        belt.position.y = 0.535; group.add(belt);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.025), brassMat);
        buckle.position.set(0, 0.535, -0.225); group.add(buckle);
        const buckleCenter = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.03), leatherMat);
        buckleCenter.position.set(0, 0.535, -0.242); group.add(buckleCenter);

        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.08), leatherMat);
        pouch.position.set(-0.17, 0.43, -0.12); pouch.rotation.z = -0.08; group.add(pouch);
        const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.025), brassMat);
        ruler.position.set(-0.245, 0.45, -0.105); ruler.rotation.z = -0.1; group.add(ruler);
        const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 6), woodMat);
        hammerHandle.position.set(0.18, 0.43, -0.08); hammerHandle.rotation.z = -0.12; group.add(hammerHandle);
        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.055), metalMat);
        hammerHead.position.set(0.165, 0.565, -0.08); group.add(hammerHead);
        const tapeMeasure = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 10), brassMat);
        tapeMeasure.rotation.x = Math.PI / 2;
        tapeMeasure.position.set(0.19, 0.45, -0.205); group.add(tapeMeasure);
        const tapeHub = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.061, 8), leatherMat);
        tapeHub.rotation.x = Math.PI / 2;
        tapeHub.position.copy(tapeMeasure.position); group.add(tapeHub);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8), skinMat);
        head.scale.set(0.92, 1.08, 0.92); head.position.y = 1.105;
        head.castShadow = true; group.add(head);
        const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.218, 9, 7), hairMat);
        hairCap.scale.set(1.04, 0.7, 1.03); hairCap.position.set(0, 1.225, 0.005); group.add(hairCap);
        // 短亂髮束的圓錐尖端必須由頭皮往外：ConeGeometry 的根部在本地
        // -Y、尖端在 +Y，因此左側用正 Z 旋轉、右側用負 Z 旋轉。舊版符號
        // 剛好相反，導致髮尖朝頭內，看起來像刺進腦袋。
        [
          [-0.17, 1.245, -0.07, 0.72, -0.24, 0.15],
          [-0.105, 1.305, -0.09, 0.42, -0.36, 0.16],
          [-0.025, 1.335, -0.105, 0.14, -0.42, 0.145],
          [0.055, 1.325, -0.095, -0.2, -0.38, 0.155],
          [0.13, 1.285, -0.075, -0.48, -0.3, 0.15],
          [0.185, 1.225, -0.04, -0.72, -0.16, 0.14],
        ].forEach(([x, y, z, rotationZ, rotationX, length]) => {
          const tuft = new THREE.Mesh(
            new THREE.ConeGeometry(0.052, length, 5),
            hairMat,
          );
          tuft.position.set(x, y, z);
          tuft.rotation.set(rotationX, 0, rotationZ);
          group.add(tuft);
        });
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.062, 5), skinMat);
        nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.09, -0.195); group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), mat(0x281d18));
          eye.scale.set(1, 0.62, 0.35); eye.position.set(side * 0.072, 1.135, -0.188); group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.014, 0.012), hairMat);
          brow.position.set(side * 0.072, 1.18, -0.193); brow.rotation.z = side * -0.1; group.add(brow);
        }
        addDefaultHumanoidSmile(group, 1.045, -0.2, 0x63382e);
        const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 6), mat(0xd78a31));
        pencil.position.set(-0.205, 1.18, -0.015); pencil.rotation.z = -0.32; group.add(pencil);

        function makeArm(side) {
          const pivot: any = new THREE.Group(); pivot.position.set(side * 0.255, 0.91, 0);
          const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.057, 0.25, 7), jacketMat);
          sleeve.position.y = -0.12; pivot.add(sleeve);
          const rolledCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.061, 0.075, 7), shirtMat);
          rolledCuff.position.y = -0.255; pivot.add(rolledCuff);
          const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.043, 0.19, 7), skinMat);
          forearm.position.y = -0.36; pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), skinMat);
          hand.scale.set(0.85, 1.08, 0.8); hand.position.y = -0.475; pivot.add(hand);
          group.add(pivot); return pivot;
        }
        parts.armL = makeArm(-1); parts.armR = makeArm(1);
        function makeLeg(side) {
          const pivot = new THREE.Group(); pivot.position.set(side * 0.105, 0.46, 0.01);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.38, 7), trouserMat);
          leg.position.y = -0.19; pivot.add(leg);
          const kneePatch = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.13, 0.025), patchMat);
          kneePatch.position.set(0, -0.19, -0.072); pivot.add(kneePatch);
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.13, 0.22), bootMat);
          boot.position.set(0, -0.395, -0.04); pivot.add(boot);
          const sole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.235), soleMat);
          sole.position.set(0, -0.442, -0.045); pivot.add(sole);
          for (let lace = 0; lace < 3; lace++) {
            const bootLace = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.009, 0.012), brassMat);
            bootLace.position.set(0, -0.36 - lace * 0.027, -0.158); pivot.add(bootLace);
          }
          group.add(pivot); return pivot;
        }
        parts.legL = makeLeg(-1); parts.legR = makeLeg(1);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.378));
        return group;
      }

      // 船長——不住島上、每天跑補給船的老船長。灰黑短髮＋灰鬢角、
      // 卡其船帽(米色帽身＋深藍帽緣)、海軍藍船員外套內搭藍毛衣、
      // 鏽紅色頸巾、胸前一枚黃銅羅盤吊飾＋小木牌，皮腰帶掛小皮囊，
      // 卡其工作褲＋深藍雨鞋。雙腳站距加寬、外八，呼應「迎風站穩」的
      // 站姿設定；兩手姿態刻意不對稱(一手鬆握、一手掌心朝下)，靠
      // 手臂 pivot 的初始 rotation.z/y 就能做到，animateWalk() 只動
      // rotation.x，不會洗掉這裡設的姿勢。腰間掛一捆盤起來的麻繩，
      // 純裝飾道具，不是真的握在手裡。
      export function makeCaptain() {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xc4855a), hairMat = mat(0x3a3a3d), sideburnMat = mat(0x74747a);
        const jacketMat = mat(0x1f3a5f), jacketEdgeMat = mat(0x2c4d78);
        const sweaterMat = mat(0x3f6ea5);
        const trouserMat = mat(0xa89468), bootMat = mat(0x1f3a5f), bootTrimMat = mat(0x5a7a9c);
        const leatherMat = mat(0x56351f), soleMat = mat(0x211b17);
        const brassMat = mat(0xb27b2d), woodMat = mat(0x6a4228);
        const capMat = mat(0xcbb693), capTrimMat = mat(0x1f3a5f);
        const scarfMat = mat(0xb5502a), ropeMat = mat(0xc2a06a);

        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.22, 0.18, 8), trouserMat);
        pelvis.position.y = 0.48; group.add(pelvis);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.225, 0.42, 8), sweaterMat);
        torso.position.y = 0.76; torso.castShadow = true; group.add(torso);

        // 海軍藍船員外套——敞開式兩片，露出中間藍毛衣，跟木匠的西裝外套
        // 同款作法但顏色/比例改成較厚實的水手外套感。
        for (const side of [-1, 1]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.44, 0.11), jacketMat);
          panel.position.set(side * 0.135, 0.75, 0.02); panel.rotation.z = side * -0.06;
          panel.castShadow = true; group.add(panel);
          const collar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), jacketEdgeMat);
          collar.position.set(side * 0.075, 0.955, -0.09); collar.rotation.z = side * 0.5;
          group.add(collar);
          const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.022), jacketEdgeMat);
          pocket.position.set(side * 0.13, 0.66, -0.115); group.add(pocket);
          for (let i = 0; i < 2; i++) {
            const button = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 7), brassMat);
            button.rotation.x = Math.PI / 2; button.position.set(side * 0.135, 0.72 - i * 0.11, -0.145);
            group.add(button);
          }
        }
        // 鏽紅頸巾——脖子下方一圈扁環＋垂下的一角，暖色系呼應鏽紅配色。
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.032, 5, 10), scarfMat);
        scarf.position.set(0, 0.965, 0); scarf.rotation.x = Math.PI / 2; group.add(scarf);
        const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.02), scarfMat);
        scarfTail.position.set(0.06, 0.87, -0.11); scarfTail.rotation.z = 0.15; group.add(scarfTail);

        // 黃銅羅盤吊飾＋小木牌——沿頸巾垂到胸口，agent.txt 指定的招牌道具。
        const compassCord = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 4, 10, Math.PI), brassMat);
        compassCord.position.set(0, 0.94, -0.13); compassCord.rotation.set(Math.PI / 2, 0, 0); group.add(compassCord);
        const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 10), brassMat);
        compass.rotation.x = Math.PI / 2; compass.position.set(0, 0.79, -0.155); group.add(compass);
        const compassFace = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.008, 10), mat(0xe8dcc0));
        compassFace.rotation.x = Math.PI / 2; compassFace.position.set(0, 0.79, -0.166); group.add(compassFace);
        const woodTag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.008), woodMat);
        woodTag.position.set(0.04, 0.71, -0.16); woodTag.rotation.z = 0.2; group.add(woodTag);

        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.222, 0.222, 0.07, 8), leatherMat);
        belt.position.y = 0.535; group.add(belt);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.065, 0.024), brassMat);
        buckle.position.set(0, 0.535, -0.225); group.add(buckle);
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.15, 0.075), leatherMat);
        pouch.position.set(-0.175, 0.435, -0.11); pouch.rotation.z = -0.08; group.add(pouch);

        // 腰間一捆盤起來的麻繩——疊幾圈扁 Torus 模擬盤繩，掛在腰帶右後方，
        // 純裝飾道具，不是真的握在手裡（避免手部姿勢跟著繩子綁死）。
        for (let ring = 0; ring < 3; ring++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 5, 10), ropeMat);
          coil.position.set(0.18, 0.43 + ring * 0.012, -0.13);
          coil.rotation.x = Math.PI / 2 + ring * 0.35;
          coil.rotation.z = ring * 0.6;
          group.add(coil);
        }

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8), skinMat);
        head.scale.set(0.92, 1.08, 0.92); head.position.y = 1.105;
        head.castShadow = true; group.add(head);
        // 灰黑短髮——只露出後腦杓跟兩側鬢角，頭頂大半被帽子蓋住。
        // 只取上半球：完整球體即使壓扁，前側仍會一路延伸到眼睛高度，
        // 形成整片灰色面罩。下緣停在 y=1.16，僅露出帽緣下的髮際線；
        // 兩側較長的頭髮仍交給下方獨立 sideburn 幾何。
        const hairCap = new THREE.Mesh(
          new THREE.SphereGeometry(
            0.215,
            9,
            7,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.5,
          ),
          hairMat,
        );
        hairCap.scale.set(1.02, 0.62, 1.0); hairCap.position.set(0, 1.16, 0.01); group.add(hairCap);
        for (const side of [-1, 1]) {
          const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.02), sideburnMat);
          sideburn.position.set(side * 0.195, 1.06, -0.02); group.add(sideburn);
        }
        // 船帽——米色帽身＋深藍帽緣，蓋住大半頭頂。
        // 2026-08-26：Zeppelin 反饋帽緣(深藍色那圈)下緣擋到眼睛——原本
        // capBrim(y=1.19，範圍 1.175~1.205)整圈是一片扁平的圓盤，跟
        // 眉毛(brow，y=1.178，範圍約 1.171~1.185)在 y 方向重疊了一截，
        // 從正面看帽緣剛好切過眉毛/眼睛的高度。capBody/capBrim/
        // capButton 三個一起往上抬 0.025，讓帽緣下緣落到眉毛上緣之上。
        // 2026-08-27：Zeppelin 在(鏡頭調整模式的近距離下)反饋帽子整個
        // 抬太高、帽緣跟眉毛之間留了一截明顯的空隙，看起來像飄在頭上。
        // 三個一起降回來 0.012(不是整個復原成 0.025 前的位置，只退
        // 一半多一點)：capBrim 下緣落在 y≈1.188，眉毛上緣是 1.185，
        // 留 0.003 的貼合誤差、視覺上是帽子自然貼著頭，又不會重新蓋到
        // 眉毛/眼睛。
        // 2026-08-27：帽冠原本取球面 0.62π，會越過赤道繼續往下延伸到
        // y≈1.13；因此即使帽緣加寬，正面仍看得到白色帽冠穿到藍圈下方。
        // 收成半球(0.5π)，讓帽冠底緣停在 y=1.213、藏在帽緣厚度內。
        const capBody = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
        capBody.position.set(0, 1.213, 0.005); group.add(capBody);
        const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), capTrimMat);
        capBrim.position.set(0, 1.203, 0.005); group.add(capBrim);
        const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), brassMat);
        capButton.position.set(0, 1.313, 0.005); group.add(capButton);

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.062, 5), skinMat);
        nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.09, -0.195); group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), mat(0x281d18));
          eye.scale.set(1, 0.58, 0.35); eye.position.set(side * 0.072, 1.132, -0.188); group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.014, 0.012), sideburnMat);
          brow.position.set(side * 0.072, 1.178, -0.193); brow.rotation.z = side * -0.12; group.add(brow);
        }
        addDefaultHumanoidSmile(group, 1.045, -0.2, 0x854b3c);

        // 兩隻手臂——初始 rotation.z/y 刻意不對稱：左手自然半握垂在身側，
        // 右手手腕外轉、掌心朝下，對應「一手自然半握，另一手掌心向下」
        // 的站姿設定。animateWalk() 只覆寫 rotation.x，這兩軸的姿勢會
        // 一直保留著。
        function makeArm(side) {
          const pivot: any = new THREE.Group(); pivot.position.set(side * 0.255, 0.91, 0);
          const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.25, 7), jacketMat);
          sleeve.position.y = -0.12; pivot.add(sleeve);
          const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.06, 0.05, 7), jacketEdgeMat);
          cuff.position.y = -0.25; pivot.add(cuff);
          const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.043, 0.19, 7), skinMat);
          forearm.position.y = -0.36; pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), skinMat);
          hand.scale.set(0.85, 1.05, 0.8); hand.position.y = -0.475; pivot.add(hand);
          if (side === -1) {
            // 左手：自然半握，稍微內收。
            pivot.rotation.z = 0.06; pivot.rotation.x = 0.08;
          } else {
            // 右手：外轉讓掌心朝下。
            pivot.rotation.z = -0.1; pivot.rotation.y = 0.3;
          }
          group.add(pivot); return pivot;
        }
        parts.armL = makeArm(-1); parts.armR = makeArm(1);

        // 雙腳站距加寬、腳掌外八，呼應「雙腳較寬、迎風站穩」。
        function makeLeg(side) {
          const pivot = new THREE.Group(); pivot.position.set(side * 0.14, 0.46, 0.01);
          pivot.rotation.z = side * -0.05;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.07, 0.38, 7), trouserMat);
          leg.position.y = -0.19; pivot.add(leg);
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.225), bootMat);
          boot.position.set(0, -0.395, -0.04); pivot.add(boot);
          const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.03, 0.23), bootTrimMat);
          bootTrim.position.set(0, -0.335, -0.04); pivot.add(bootTrim);
          const sole = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.035, 0.24), soleMat);
          sole.position.set(0, -0.445, -0.045); pivot.add(sole);
          group.add(pivot); return pivot;
        }
        parts.legL = makeLeg(-1); parts.legR = makeLeg(1);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.34));
        return group;
      }

      // 廚師——2026-08-27 依 Zeppelin 提供的角色設定圖建模：深棕色雙層
      // 丸子頭(頭頂疊兩顆糰子，兩側留幾綹垂下的髮絲)、赤陶紅襯衫(袖子
      // 捲到前臂)、米色頸巾、深墨綠圍裙(前胸片+肩帶+腰間圍裙裙擺，
      // 蓋在深墨綠工作褲外面)，皮腰帶上掛一把小刀(連刀鞘)、一顆黃銅
      // 小鈴鐺、一條垂下來的白色抹布，深棕色綁帶靴。
      // 這次先只做外觀＋讓她在舊城鎮廣場(LAYOUT.oldVillage.plaza)閒晃，
      // Zeppelin 明講不用對話/互動。src/chef-quest.ts 已經有一整套招募
      // 敘事(dock 見面/看屋/共餐條件/入住)在同步開發中，且
      // startChefMoveInScene() 已經會找 `npcs.find(id==="chef")`——這個
      // make 函式跟 npc-defs.ts 的 "chef" 項目就是接給那套邏輯用的正式
      // 角色模型，不是另外做的臨時替代品。目前 npc-defs.ts 讓她一路可見
      // (還沒有比照木匠那樣「quest 沒推進到 moved_in 前 mesh 隱藏」)，
      // 這是照 Zeppelin 現在的要求先讓角色看得到，之後接上
      // handleChefDockTouch/handleChefDoorstepTouch 時要記得補上那個
      // 隱藏特例，細節寫在 npc-defs.ts 那個項目的註解裡。
      //
      // 2026-08-27 比例修正：Zeppelin 截圖回報她站在其他 NPC 旁邊「小了
      // 一號」。查了 HUMANOID_WORLD_HEIGHT 這套系統才發現根因——每個角色
      // 最後都靠 `group.scale.setScalar(humanoidScale(unscaledHeight))`
      // 統一縮放到「頭頂最高點到腳底同一個世界高度(=1)」，`unscaledHeight`
      // 這個參數必須是「這個角色自己建模當下、頭頂最高點的真實 y 座標」，
      // 差一點就會讓整個角色等比例縮小或放大。第一版我用球體的算法
      // (中心 y + 半徑)去估兩顆糰子頭(DodecahedronGeometry)的頂點高度，
      // 但十二面體用 THREE.js 的建構方式頂點是正規化到「外接半徑」，最高
      // 的頂點方向其實只到半徑的 1/√3(≈0.577)，不是整個半徑——這個算錯
      // 只造成 ~2% 誤差，不是主因。真正主因是：算對高度後，發現這兩顆疊起
      // 來的糰子頭把「頭頂到最高點」這段距離撐得比其他角色都高很多(頭髮
      // 佔總高度比例達 24%，木匠/村長大概是 20%)——humanoidScale() 是把
      // 「頭到腳」整段壓進同一個世界高度，頭髮占比越高，身體(肩膀以下、
      // 實際決定「看起來多大」的部分)在最終畫面裡分到的空間就越少，整個
      // 人看起來理所當然比同樣「頭頂到腳」都是 1 個世界單位的其他角色矮
      // 一截。順便發現腳底(boot/sole)沒有像木匠、村長那樣精準落在
      // pivot 的 y=0 基準上，還多探了 0.035，也一起修正。
      // 修法：兩顆糰子頭尺寸略縮小(0.11/0.08 → 0.10/0.075)、位置降低、
      // 堆疊時彼此留自然的重疊(不是硬算出精確貼合，跟其他角色的做法一
      // 致)，讓「頭髮占總高度比例」回到跟木匠/村長同一個量級(~20%)；靴子
      // /鞋底位置上移 0.035 讓腳底精準落在 0；humanoidScale 的校正值改成
      // 實際量出來的新頂點高度 1.364(不是憑印象抓的數字)。
      // 教訓：以後新角色如果頭髮/帽子之類的裝飾比一般角色更高聳，
      // humanoidScale() 的校正參數不能只抓「頭部本身」的高度隨便加一點
      // 估计，要嘛老實把最高點的裝飾也算進去，要嘛控制裝飾高度不要讓它
      // 占掉太高比例的「總高度預算」，否則角色會在跟其他人並排站的時候
      // 明顯矮一截，即使兩人的 humanoidScale() 都設對了「頭頂到腳」正確
      // 對齊到 1 個世界單位。
      export function makeChef() {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xd9a679), hairMat = mat(0x3b2a1f);
        const shirtMat = mat(0xc1543a), shirtTrimMat = mat(0xd9c9a3);
        const kerchiefMat = mat(0xe6dcc4);
        const apronMat = mat(0x2c4a42), apronTrimMat = mat(0x3a5d54);
        const trouserMat = mat(0x24413b), cuffMat = mat(0x33544c);
        const leatherMat = mat(0x5c3c22), bootMat = mat(0x4a3220), soleMat = mat(0x211b17);
        const brassMat = mat(0xb27b2d), bladeMat = mat(0xb8bcc0), towelMat = mat(0xf0ead8);

        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.19, 0.16, 8), trouserMat);
        pelvis.position.y = 0.48; group.add(pelvis);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.2, 0.4, 8), shirtMat);
        torso.position.y = 0.75; torso.castShadow = true; group.add(torso);

        // 米色頸巾——沿用船長頸巾同一套做法(扁環+垂下的一角)，改素色米色。
        const kerchief = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.028, 5, 10), kerchiefMat);
        kerchief.position.set(0, 0.955, 0); kerchief.rotation.x = Math.PI / 2; group.add(kerchief);
        const kerchiefTail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.018), kerchiefMat);
        kerchiefTail.position.set(0.055, 0.87, -0.105); kerchiefTail.rotation.z = 0.12; group.add(kerchiefTail);

        // 圍裙——前胸片＋交叉肩帶＋腰間裙擺，整組蓋在襯衫/長褲外面，
        // 前胸片跟裙擺都刻意比身體窄一點，露出兩側襯衫/長褲，才看得出
        // 是「罩在外面」而不是換了一套連身裝。
        const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.03), apronMat);
        apronBib.position.set(0, 0.815, -0.135); group.add(apronBib);
        const apronBibTrim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.032), apronTrimMat);
        apronBibTrim.position.set(0, 0.7, -0.136); group.add(apronBibTrim);
        for (const side of [-1, 1]) {
          const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.02), apronMat);
          strap.position.set(side * 0.075, 0.93, -0.1); strap.rotation.z = side * 0.55;
          strap.rotation.x = -0.15; group.add(strap);
        }
        // 裙擺分兩層(主層+內襯層前後略錯開)，呼應設計圖裙擺中線那道
        // 開衩——低模不特別挖洞，用兩片微微交錯的面板意思到就好。
        const apronSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.03), apronMat);
        apronSkirt.position.set(0, 0.4, -0.14); apronSkirt.rotation.x = 0.05; group.add(apronSkirt);
        const apronSkirtLining = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.026), apronTrimMat);
        apronSkirtLining.position.set(0, 0.375, -0.128); group.add(apronSkirtLining);

        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 8), leatherMat);
        belt.position.y = 0.535; group.add(belt);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.022), brassMat);
        buckle.position.set(0, 0.535, -0.205); group.add(buckle);

        // 皮鞘小刀——掛在腰帶右後方。
        const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.03), leatherMat);
        sheath.position.set(0.165, 0.42, -0.09); sheath.rotation.z = 0.1; group.add(sheath);
        const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 4), bladeMat);
        bladeTip.position.set(0.168, 0.505, -0.09); bladeTip.rotation.z = 0.1; group.add(bladeTip);

        // 黃銅小鈴鐺——一小截皮繩掛在腰帶左前方。
        const bellCord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 5), leatherMat);
        bellCord.position.set(-0.155, 0.485, -0.11); group.add(bellCord);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 5), brassMat);
        bell.position.set(-0.155, 0.45, -0.11); group.add(bell);

        // 白色抹布——摺過一次塞在腰帶上，垂下來一截。
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.014), towelMat);
        towel.position.set(0.06, 0.4, -0.145); towel.rotation.z = -0.08; group.add(towel);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skinMat);
        head.scale.set(0.94, 1.05, 0.94); head.position.y = 1.09;
        head.castShadow = true; group.add(head);
        // 髮帽修正（2026-08-27）：原本 scale.set(1.02,0.6,1.0) + position y=1.135 導致兩個問題──
        // (1) 頭頂露出「禿頭」：hairCap 頂點只到 1.2622，頭骨本身頂點卻到 1.30，中間有 0.038 空隙。
        // (2) 「頭髮蓋到眼睛」：hairCap 是完整未裁切的橢球體，z 方向半徑(0.212)比臉部本身還大，
        //     且中心點(y=1.135)太接近眼睛高度(y=1.12)，導致橢球體在眼睛高度往前凸出到 z=-0.2005，
        //     比眼睛本身的 z=-0.183 還要靠前──頭髮實際蓋住了眼睛，不是視覺錯覺。
        // 修正：把 y-scale 加大(0.6→0.75)並把中心點抬高(1.135→1.16)，讓橢球體「腰身」離開臉部區域、
        // 改用赤道以下較窄的下緣覆蓋眼周；同時把 z-scale 縮小(1.0→0.75)減少整體前凸幅度。
        // 用 Python 驗證過（~/verify_chef_hair_fix.py）：新頂點 1.319 > 頭頂 1.30（禿頭修好），
        // 在眼睛/眉毛/鼻子高度的 z 方向都有 0.039～0.048 的安全距離（不再蓋到臉）。
        // 頂部仍低於 bunUpper 的頂點 1.364，所以 humanoidScale(1.364) 的校準值不受影響、不需要重算。
        const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.212, 9, 7), hairMat);
        hairCap.scale.set(1.02, 0.75, 0.75); hairCap.position.set(0, 1.16, 0.01); group.add(hairCap);
        // 雙層丸子頭——用低面數的十二面體(Dodecahedron)取代球體，稜面感
        // 剛好適合「隨性盤起來」的糰子頭，不用另外做髮絲細節。
        const bunLower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), hairMat);
        bunLower.scale.set(1.05, 0.95, 1.0); bunLower.position.set(0, 1.255, 0.015); group.add(bunLower);
        const bunUpper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.075, 0), hairMat);
        bunUpper.scale.set(1.05, 0.9, 1.0); bunUpper.position.set(0, 1.325, 0.02); group.add(bunUpper);
        // 兩側垂下的幾綹髮絲——跟木匠那種「往外翹」的短髮束方向相反，
        // 這裡是從太陽穴往下垂，錐尖朝下(旋轉角度跟木匠版是反過來的)。
        [
          [-0.185, 1.08, -0.05, 2.9, 0.12],
          [-0.15, 1.02, -0.14, 3.05, 0.1],
          [0.185, 1.08, -0.05, -2.9, 0.12],
          [0.15, 1.02, -0.14, -3.05, 0.1],
        ].forEach(([x, y, z, rotationZ, length]) => {
          const strand = new THREE.Mesh(new THREE.ConeGeometry(0.018, length, 5), hairMat);
          strand.position.set(x, y, z); strand.rotation.z = rotationZ; group.add(strand);
        });

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.055, 5), skinMat);
        nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.115, -0.19); group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), mat(0x2b211b));
          eye.scale.set(1, 0.6, 0.35); eye.position.set(side * 0.07, 1.12, -0.183); group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), hairMat);
          brow.position.set(side * 0.07, 1.16, -0.188); brow.rotation.z = side * -0.16; group.add(brow);
          const blush = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), mat(0xe8869a));
          blush.scale.set(1, 0.55, 0.3); blush.position.set(side * 0.1, 1.075, -0.175); group.add(blush);
        }
        addDefaultHumanoidSmile(group, 1.04, -0.195, 0x8a4a3c);

        function makeArm(side) {
          const pivot: any = new THREE.Group(); pivot.position.set(side * 0.235, 0.9, 0);
          const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.054, 0.22, 7), shirtMat);
          sleeve.position.y = -0.11; pivot.add(sleeve);
          const rolledCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.057, 0.055, 7), shirtTrimMat);
          rolledCuff.position.y = -0.225; pivot.add(rolledCuff);
          const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.2, 7), skinMat);
          forearm.position.y = -0.335; pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 5), skinMat);
          hand.scale.set(0.85, 1.05, 0.8); hand.position.y = -0.45; pivot.add(hand);
          group.add(pivot); return pivot;
        }
        parts.armL = makeArm(-1); parts.armR = makeArm(1);
        function makeLeg(side) {
          const pivot = new THREE.Group(); pivot.position.set(side * 0.1, 0.44, 0.01);
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.34, 7), trouserMat);
          leg.position.y = -0.17; pivot.add(leg);
          const ankleCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.04, 7), cuffMat);
          ankleCuff.position.y = -0.29; pivot.add(ankleCuff);
          // 2026-08-27：靴子/鞋底原本往下多探了 0.035，腳底沒有真的貼在
          // pivot 的 y=0 落地基準上(木匠/村長的靴子鞋底都精準落在 0)，
          // 這裡一起往上收 0.035 對齊，跟下面 humanoidScale 校正是同一輪
          // 「廚師比例比其他角色小一號」問題的其中一個成因，記錄在
          // makeChef() 開頭的比例修正註解裡。
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.13, 0.21), bootMat);
          boot.position.set(0, -0.375, -0.035); pivot.add(boot);
          const sole = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.032, 0.225), soleMat);
          sole.position.set(0, -0.421, -0.04); pivot.add(sole);
          for (let lace = 0; lace < 3; lace++) {
            const bootLace = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.008, 0.012), brassMat);
            bootLace.position.set(0, -0.34 - lace * 0.026, -0.15); pivot.add(bootLace);
          }
          group.add(pivot); return pivot;
        }
        parts.legL = makeLeg(-1); parts.legR = makeLeg(1);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.364));
        return group;
      }

      export function makeGirlPlayer({
        skin = 0xffe3c9,
        outfit = 0xff8fab,
        skirt = 0xdb5f86,
        hair = 0x5a3a2a,
        ribbon = 0xff5577,
      } = {}) {
        const group: any = new THREE.Group();
        const parts: any = {};
        const skinMat = new THREE.MeshStandardMaterial({ color: skin });
        const outfitMat = new THREE.MeshStandardMaterial({ color: outfit });
        const skirtMat = new THREE.MeshStandardMaterial({ color: skirt });
        const hairMat = new THREE.MeshStandardMaterial({ color: hair });

        // 身體比一般人形略短、略窄，頭比例加大 —— chibi 比例本身就是「可愛」的視覺捷徑
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.18, 0.3, 8),
          outfitMat,
        );
        body.position.y = 0.33;
        body.castShadow = true;
        group.add(body);

        // 裙子：一顆張開的圓錐罩在腰跟大腿上方，跟腳的動畫分開，不會跟著走路擺動
        const skirtMesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.27, 0.22, 10),
          skirtMat,
        );
        skirtMesh.position.y = 0.24;
        skirtMesh.castShadow = true;
        group.add(skirtMesh);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 12, 10),
          skinMat,
        );
        head.position.y = 0.68;
        head.castShadow = true;
        group.add(head);

        const hairCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.245, 12, 10),
          hairMat,
        );
        hairCap.scale.set(1, 0.62, 1.05);
        hairCap.position.set(0, 0.78, -0.02);
        group.add(hairCap);

        // 雙馬尾 —— 側邊斜出去的圓柱 + 球形尾端，這是最低成本就能讀出「女孩子」的髮型
        function makePonytail(side) {
          const g = new THREE.Group();
          const tail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.02, 0.26, 6),
            hairMat,
          );
          tail.rotation.z = side * 0.55;
          tail.position.set(side * 0.22, 0.7, -0.05);
          const tip = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 8, 6),
            hairMat,
          );
          tip.position.set(side * 0.32, 0.58, -0.09);
          g.add(tail, tip);
          return g;
        }
        group.add(makePonytail(-1), makePonytail(1));

        // 馬尾根部的小蝴蝶結
        function makeRibbon(side) {
          const bow = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.03),
            new THREE.MeshStandardMaterial({ color: ribbon }),
          );
          bow.position.set(side * 0.19, 0.76, -0.03);
          return bow;
        }
        group.add(makeRibbon(-1), makeRibbon(1));

        // 腮紅 —— 壓扁的小球貼在臉頰，低模角色加這個 CP 值很高
        function makeBlush(side) {
          const b = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 4),
            new THREE.MeshStandardMaterial({ color: 0xff9eb5 }),
          );
          b.scale.set(1, 0.6, 0.3);
          b.position.set(side * 0.11, 0.635, -0.19);
          return b;
        }
        group.add(makeBlush(-1), makeBlush(1));

        const nose = new THREE.Mesh(
          new THREE.ConeGeometry(0.022, 0.045, 6),
          skinMat,
        );
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.665, -0.215);
        group.add(nose);

        // 同樣的肩膀/髖部支點修正，數字配合她比較嬌小的身材比例
        function makeArm(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.2, 0.46, 0);
          const shoulder = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 8, 6),
            skinMat,
          );
          pivot.add(shoulder);
          const armLen = 0.26;
          const arm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.038, armLen, 6),
            skinMat,
          );
          arm.position.y = -armLen / 2;
          arm.castShadow = true;
          pivot.add(arm);
          group.add(pivot);
          return pivot;
        }
        parts.armL = makeArm(-1);
        parts.armR = makeArm(1);

        // 釣魚竿：掛在右手支點下面，跟著手臂支點一起轉——手怎麼揮，竿就怎麼甩，
        // 不用另外算竿子的動畫，平常隱藏，只有釣魚中才顯示
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.016, 0.55, 5),
          new THREE.MeshStandardMaterial({ color: 0x6b4a30 }),
        );
        rod.position.set(-0.06, -0.23, 0.12);
        rod.rotation.x = -1.0;
        rod.rotation.z = 0.15;
        rod.visible = false;
        parts.armR.add(rod);
        parts.rod = rod;

        // 腿保留細一點、裙子底下露出來，跟裙子分開才能繼續做走路擺動
        function makeLeg(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.08, 0.26, 0);
          const legLen = 0.26;
          const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.05, legLen, 6),
            skinMat,
          );
          leg.position.y = -legLen / 2;
          leg.castShadow = true;
          pivot.add(leg);
          group.add(pivot);
          return pivot;
        }
        parts.legL = makeLeg(-1);
        parts.legR = makeLeg(1);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(0.932));
        return group;
      }

      // 主角專用低多邊形模型。依 hero.png 的服裝與輪廓製作，面朝本地 -Z；
      // parts/rod 介面與原主角一致，釣魚及走路狀態不需另外分支。
      function makeAdventurerHero(female = false) {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) =>
          new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xe0a06e);
        const hairMat = mat(female ? 0x51404f : 0xa84f1c);
        const jacketMat = mat(0x486548);
        const shirtMat = mat(0xe2d4ad);
        const pantsMat = mat(0xb88a4d);
        const leatherMat = mat(0x51351f);
        const strapMat = mat(0xb69a69);
        const brassMat = mat(0xb77c28);

        const torso = new THREE.Mesh(
          new THREE.CylinderGeometry(
            female ? 0.155 : 0.17,
            female ? 0.185 : 0.2,
            0.34,
            8,
          ),
          shirtMat,
        );
        torso.position.y = 0.62;
        torso.castShadow = true;
        group.add(torso);

        // 男主角是短外套，女主角是參考圖中的綠色短背心。
        for (const side of [-1, 1]) {
          const jacket = new THREE.Mesh(
            new THREE.BoxGeometry(female ? 0.115 : 0.14, female ? 0.31 : 0.37, 0.11),
            jacketMat,
          );
          jacket.position.set(side * (female ? 0.115 : 0.13), female ? 0.65 : 0.63, 0.015);
          jacket.rotation.z = side * -0.055;
          jacket.castShadow = true;
          group.add(jacket);
          const lapel = new THREE.Mesh(
            new THREE.ConeGeometry(0.065, 0.19, 3),
            jacketMat,
          );
          lapel.position.set(side * 0.075, 0.75, -0.078);
          lapel.rotation.z = side * 0.35;
          group.add(lapel);
        }

        const belt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.205, 0.205, 0.065, 8),
          leatherMat,
        );
        belt.position.y = 0.45;
        group.add(belt);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 0.025), brassMat);
        buckle.position.set(0, 0.45, -0.205);
        group.add(buckle);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.205, 10, 8),
          skinMat,
        );
        head.scale.set(0.95, 1.06, 0.94);
        head.position.y = 1.0;
        head.castShadow = true;
        group.add(head);

        const hairCap = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 9, 7),
          hairMat,
        );
        hairCap.scale.set(1.05, 0.68, 1.05);
        hairCap.position.set(0, 1.115, 0.005);
        group.add(hairCap);
        if (female) {
          // 側編髮與低側馬尾位於角色本地 +X（正面觀看時的畫面左側）。
          for (let i = 0; i < 4; i++) {
            const braid = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.045 - i * 0.004, 0),
              hairMat,
            );
            braid.position.set(0.17 + i * 0.025, 1.13 - i * 0.055, -0.07);
            braid.rotation.z = 0.4;
            group.add(braid);
          }
          const ponytail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.045, 0.34, 7),
            hairMat,
          );
          ponytail.position.set(0.22, 0.92, 0.08);
          ponytail.rotation.z = -0.32;
          group.add(ponytail);
          const ponytailTip = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.085, 0),
            hairMat,
          );
          ponytailTip.scale.set(0.8, 1.25, 0.8);
          ponytailTip.position.set(0.27, 0.78, 0.07);
          group.add(ponytailTip);
          const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 8), mat(0x8a6337));
          hairTie.position.set(0.18, 1.04, 0.06);
          hairTie.rotation.x = Math.PI / 2;
          group.add(hairTie);
        } else {
          // 放射狀髮束與頂端呆毛，保持俯視時仍有清楚剪影。
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const spike = new THREE.Mesh(
              new THREE.ConeGeometry(0.045, 0.18, 5),
              hairMat,
            );
            spike.position.set(Math.cos(a) * 0.16, 1.13, Math.sin(a) * 0.13);
            spike.rotation.z = Math.cos(a) * 1.05;
            spike.rotation.x = Math.sin(a) * 1.05;
            group.add(spike);
          }
          const cowlick = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.18, 5), hairMat);
          cowlick.position.set(0.025, 1.32, 0);
          cowlick.rotation.z = -0.28;
          group.add(cowlick);
        }

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.023, 0.05, 5), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.99, -0.195);
        group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat(0x3b291d));
          eye.scale.set(1, 0.75, 0.35);
          eye.position.set(side * 0.073, 1.03, -0.188);
          group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.011, 0.012), hairMat);
          brow.position.set(side * 0.073, 1.077, -0.192);
          brow.rotation.z = side * -0.08;
          group.add(brow);
        }
        // 與村長相同的兩段式輕微笑，避免水平嘴線看起來像苦瓜臉。
        addDefaultHumanoidSmile(group, 0.945, -0.201);

        // 貝殼墜飾與斜背帶。
        const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.008, 4, 10, Math.PI), brassMat);
        necklace.position.set(0, 0.74, -0.188);
        group.add(necklace);
        const shell = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 6), brassMat);
        shell.position.set(0, 0.685, -0.195);
        shell.rotation.z = Math.PI;
        group.add(shell);
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.58, 0.025), strapMat);
        strap.position.set(0, 0.6, -0.205);
        const strapAngle = female ? -0.55 : 0.55;
        const satchelSide = female ? -1 : 1;
        strap.rotation.z = strapAngle;
        group.add(strap);
        const backStrap = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.58, 0.025),
          strapMat,
        );
        backStrap.position.set(0, 0.6, 0.17);
        backStrap.rotation.z = strapAngle;
        group.add(backStrap);
        const shoulderStrap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.027, 0.027, 0.375, 5),
          strapMat,
        );
        shoulderStrap.position.set(satchelSide * -0.15, 0.85, -0.018);
        shoulderStrap.rotation.x = Math.PI / 2;
        group.add(shoulderStrap);
        const strapToSatchel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.027, 0.027, 0.19, 5),
          strapMat,
        );
        strapToSatchel.position.set(satchelSide * 0.185, 0.41, -0.105);
        strapToSatchel.rotation.x = Math.PI / 2;
        strapToSatchel.rotation.z = satchelSide * -0.22;
        group.add(strapToSatchel);
        const backStrapToSatchel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.027, 0.027, 0.185, 5),
          strapMat,
        );
        backStrapToSatchel.position.set(satchelSide * 0.17, 0.37, 0.075);
        backStrapToSatchel.rotation.x = Math.PI / 2;
        group.add(backStrapToSatchel);

        function makeArm(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.235, 0.75, 0);
          const sleeve = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.05, female ? 0.26 : 0.19, 7),
            female ? shirtMat : jacketMat,
          );
          sleeve.position.y = female ? -0.125 : -0.09;
          pivot.add(sleeve);
          const forearm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.045, 0.18, 6),
            skinMat,
          );
          forearm.position.y = female ? -0.31 : -0.255;
          pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 5), skinMat);
          hand.position.y = female ? -0.405 : -0.36;
          pivot.add(hand);
          group.add(pivot);
          return pivot;
        }
        parts.armL = makeArm(-1);
        parts.armR = makeArm(1);

        function makeLeg(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.105, 0.44, 0);
          const pantLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.07, 0.4, 7),
            pantsMat,
          );
          pantLeg.position.y = -0.2;
          pivot.add(pantLeg);
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.2), leatherMat);
          boot.position.set(0, -0.38, -0.035);
          boot.castShadow = true;
          pivot.add(boot);
          group.add(pivot);
          return pivot;
        }
        parts.legL = makeLeg(-1);
        parts.legR = makeLeg(1);

        const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.19, 0.09), strapMat);
        satchel.position.set(satchelSide * 0.22, 0.35, -0.015);
        satchel.rotation.y = satchelSide * -0.35;
        group.add(satchel);
        const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.095, 7, 5), mat(0x66713e));
        pouch.scale.set(0.85, 1, 0.55);
        pouch.position.set(satchelSide * -0.2, 0.4, -0.08);
        group.add(pouch);

        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.016, 0.55, 5),
          mat(0x6b4a30),
        );
        // 顺着前臂向手掌外延伸；挥竿方向完全由肩膀支点控制。
        rod.position.set(0, -0.56, 0);
        rod.rotation.z = 0.05;
        rod.visible = false;
        parts.armR.add(rod);
        parts.rod = rod;

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.265));
        return group;
      }
      // 保留已完成的男主角版本，方便隨時切回或做角色選擇功能。
      export function makeMaleHeroPlayer() {
        return makeAdventurerHero(false);
      }

      // 舊村女神祠堂平台上的靜態女神。概念圖特徵：水藍長髮、青綠眼睛、
      // 白色立領長裙、藍綠外裙、半透明披帛與貝殼／珊瑚髮飾。純視覺模型，
      // 不掛 parts 動畫、NPC 排程、碰撞、對話或互動；臉仍朝本地 -Z。
      export function makeGoddess() {
        const group: any = new THREE.Group();
        const mat = (color, options: THREE.MeshStandardMaterialParameters = {}) =>
          new THREE.MeshStandardMaterial({ color, flatShading: true, ...options });
        const skinMat = mat(0xf2c7a9);
        const whiteMat = mat(0xf2eee4);
        const paleBlueMat = mat(0x9ddce5);
        const oceanMat = mat(0x2589a8);
        const deepOceanMat = mat(0x17677f);
        const hairMat = mat(0x5bb9cd);
        const hairShadeMat = mat(0x328ca5);
        const goldMat = mat(0xd4ad68, { metalness: 0.25, roughness: 0.5 });
        const pearlMat = mat(0xf3f1df, { metalness: 0.05, roughness: 0.28 });
        const eyeMat = mat(0x157c89);
        const sheerMat = mat(0x9edee8, {
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        // 腳底 y=0；裙身以多層低多邊形錐台組成，不露出腿部穿模。
        for (const side of [-1, 1]) {
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.22), paleBlueMat);
          boot.position.set(side * 0.105, 0.09, -0.035);
          boot.castShadow = true;
          group.add(boot);
          const bootBand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.225), goldMat);
          bootBand.position.set(side * 0.105, 0.105, -0.04);
          group.add(bootBand);
        }
        const innerSkirt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.34, 0.7, 8),
          whiteMat,
        );
        innerSkirt.position.y = 0.46;
        innerSkirt.castShadow = true;
        group.add(innerSkirt);
        for (const side of [-1, 1]) {
          const outerSkirt = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 0.72, 4, 1, true),
            side < 0 ? oceanMat : paleBlueMat,
          );
          outerSkirt.scale.set(0.72, 1, 0.72);
          outerSkirt.position.set(side * 0.17, 0.47, 0.02);
          outerSkirt.rotation.y = Math.PI / 4;
          outerSkirt.rotation.z = side * -0.07;
          group.add(outerSkirt);
        }
        const torso = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.205, 0.38, 8),
          whiteMat,
        );
        torso.position.y = 0.84;
        torso.castShadow = true;
        group.add(torso);
        const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.075, 8), deepOceanMat);
        waist.position.y = 0.66;
        group.add(waist);
        const shellBuckle = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), goldMat);
        shellBuckle.scale.set(1.2, 0.58, 0.32);
        shellBuckle.position.set(0, 0.665, -0.205);
        group.add(shellBuckle);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 0.12, 8), paleBlueMat);
        collar.position.y = 1.045;
        group.add(collar);
        const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), oceanMat);
        pendant.position.set(0, 0.98, -0.174);
        group.add(pendant);

        // 短袖、前臂與手掌全部掛在同一個肩膀支點，並讓相鄰幾何稍微重疊；
        // 各段若直接用世界座標分開旋轉，手肘處會像上一版一樣裂開。
        // 半透明披袖仍掛在肩後，形成概念圖的大披帛輪廓。
        for (const side of [-1, 1]) {
          const armPivot = new THREE.Group();
          armPivot.position.set(side * 0.225, 0.97, 0);
          armPivot.rotation.z = side * -0.1;
          const shortSleeve = new THREE.Mesh(
            new THREE.CylinderGeometry(0.072, 0.055, 0.24, 7),
            paleBlueMat,
          );
          shortSleeve.position.y = -0.115;
          armPivot.add(shortSleeve);
          const sleeveCuff = new THREE.Mesh(
            new THREE.TorusGeometry(0.055, 0.012, 5, 8),
            goldMat,
          );
          sleeveCuff.position.y = -0.23;
          sleeveCuff.rotation.x = Math.PI / 2;
          armPivot.add(sleeveCuff);
          const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.27, 7), skinMat);
          forearm.position.y = -0.35;
          armPivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.047, 7, 5), skinMat);
          hand.scale.set(0.75, 1.18, 0.7);
          hand.position.y = -0.505;
          armPivot.add(hand);
          group.add(armPivot);
          const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.64, 4, 1, true), sheerMat);
          sleeve.scale.set(0.72, 1, 0.58);
          sleeve.position.set(side * 0.29, 0.69, 0.08);
          sleeve.rotation.z = side * -0.2;
          sleeve.rotation.y = Math.PI / 4;
          group.add(sleeve);
        }

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.195, 10, 8), skinMat);
        head.scale.set(0.94, 1.08, 0.92);
        head.position.y = 1.175;
        head.castShadow = true;
        group.add(head);
        // 髮帽抬高並縮短前後半徑，避免像早期廚師模型一樣蓋住眼睛。
        const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), hairMat);
        hairCap.scale.set(1.03, 0.68, 0.76);
        hairCap.position.set(0, 1.285, 0.018);
        group.add(hairCap);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 7, 5), eyeMat);
          eye.scale.set(1.1, 0.62, 0.34);
          eye.position.set(side * 0.068, 1.205, -0.181);
          group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.01), hairShadeMat);
          brow.position.set(side * 0.068, 1.245, -0.186);
          brow.rotation.z = side * -0.12;
          group.add(brow);
          const frontLock = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.27, 5), hairMat);
          frontLock.position.set(side * 0.115, 1.19, -0.135);
          frontLock.rotation.z = side * 0.18;
          frontLock.rotation.x = -0.12;
          group.add(frontLock);
        }
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.058, 5), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 1.165, -0.19);
        group.add(nose);
        addDefaultHumanoidSmile(group, 1.12, -0.191, 0x9b5f55);

        // 長髮從後腦一路垂到腰下，用交錯髮束避免整片像實心披風。
        [-0.19, -0.11, -0.035, 0.045, 0.12, 0.19].forEach((x, index) => {
          const length = 0.58 + (index % 3) * 0.08;
          const strand = new THREE.Mesh(
            new THREE.ConeGeometry(0.075, length, 5),
            index % 2 ? hairMat : hairShadeMat,
          );
          strand.position.set(x, 0.98 - length * 0.17, 0.115 + Math.abs(x) * 0.16);
          strand.rotation.z = x * -0.32;
          strand.rotation.x = 0.08;
          group.add(strand);
        });
        // 側邊珊瑚枝、珍珠與飄帶。
        for (let i = 0; i < 3; i++) {
          const coral = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.16, 5), goldMat);
          coral.position.set(0.205 + i * 0.025, 1.31 + i * 0.025, 0.015);
          coral.rotation.z = -0.45 - i * 0.2;
          group.add(coral);
          const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.025 - i * 0.003, 7, 5), pearlMat);
          pearl.position.set(0.215 + i * 0.035, 1.28 + i * 0.055, -0.015);
          group.add(pearl);
        }
        for (const side of [-1, 1]) {
          const ribbon = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 4, 1, true), sheerMat);
          ribbon.scale.set(0.55, 1, 0.35);
          ribbon.position.set(side * 0.22, 1.05, 0.2);
          ribbon.rotation.z = side * -0.34;
          ribbon.rotation.x = 0.22;
          group.add(ribbon);
        }

        // 頭髮主體最高點約 1.428；珊瑚／飄帶是額外裝飾，不納入統一身高校正。
        group.scale.setScalar(humanoidScale(1.428));
        return group;
      }

      // 山頂鳥居前的靜態守護者角色：銀白長髮半束、綠色和服外套配金色葉紋、
      // 紅色腰繩、褐色縛口袴褲、深褐金邊靴。沿用 makeAdventurerHero 的
      // 軀幹/頭部 Y 座標與 1.265 未縮放基準高度（髮冠頂端同樣落在 y=1.265），
      // 髮束、髮飾與小樹枝屬於突出裝飾，依慣例不計入基準高度。
      export function makeMountainGuardian() {
        const group: any = new THREE.Group();
        const parts: any = {};
        const mat = (color) =>
          new THREE.MeshStandardMaterial({ color, flatShading: true });
        const skinMat = mat(0xf0c8a0);
        const hairMat = mat(0xe8e6de);
        const kimonoMat = mat(0x4f6b3a);
        const innerMat = mat(0xf0e8d8);
        const cordMat = mat(0xb3382c);
        const goldMat = mat(0xc9a227);
        const hakamaMat = mat(0x5a4530);
        const bootMat = mat(0x2f241c);
        const twigMat = mat(0x6b4a30);
        const leafMat = mat(0x7c8f4a);
        const eyeMat = mat(0x5a3d22);

        const torso = new THREE.Mesh(
          new THREE.CylinderGeometry(0.155, 0.185, 0.34, 8),
          innerMat,
        );
        torso.position.y = 0.62;
        torso.castShadow = true;
        group.add(torso);

        // 交領和服外套側片與翻領，中間露出米色內衫形成 V 領。
        for (const side of [-1, 1]) {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.34, 0.115),
            kimonoMat,
          );
          panel.position.set(side * 0.125, 0.64, 0.015);
          panel.rotation.z = side * -0.05;
          panel.castShadow = true;
          group.add(panel);
          const lapel = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 3), kimonoMat);
          lapel.position.set(side * 0.08, 0.755, -0.075);
          lapel.rotation.z = side * 0.38;
          group.add(lapel);
        }
        const collarInsert = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.16, 3),
          innerMat,
        );
        collarInsert.position.set(0, 0.78, -0.09);
        group.add(collarInsert);

        // 胸前紅繩結與金色葉形飾扣。
        const cordWrap = new THREE.Mesh(
          new THREE.TorusGeometry(0.175, 0.014, 5, 10, Math.PI * 1.1),
          cordMat,
        );
        cordWrap.position.set(0, 0.715, 0);
        cordWrap.rotation.x = Math.PI / 2;
        cordWrap.rotation.z = Math.PI * 0.45;
        group.add(cordWrap);
        const cordKnot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), cordMat);
        cordKnot.position.set(0, 0.7, -0.18);
        group.add(cordKnot);
        const leafBrooch = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.02, 4), goldMat);
        leafBrooch.rotation.x = Math.PI / 2;
        leafBrooch.position.set(0, 0.735, -0.185);
        group.add(leafBrooch);

        // 紅色腰繩取代皮帶，後方垂下兩條繩尾。
        const sash = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8),
          cordMat,
        );
        sash.position.y = 0.45;
        group.add(sash);
        for (const side of [-1, 1]) {
          const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.012), cordMat);
          tail.position.set(side * 0.05, 0.36, 0.19);
          tail.rotation.x = 0.15;
          group.add(tail);
        }

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8), skinMat);
        head.scale.set(0.95, 1.06, 0.94);
        head.position.y = 1.0;
        head.castShadow = true;
        group.add(head);

        const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 9, 7), hairMat);
        hairCap.scale.set(1.05, 0.68, 1.05);
        hairCap.position.set(0, 1.115, 0.005);
        group.add(hairCap);

        // 頭頂半束髮髻，以紅繩繫綁，插一小截樹枝與葉片作裝飾（突出裝飾，
        // 不計入基準高度）。
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hairMat);
        bun.scale.set(1, 0.85, 1);
        bun.position.set(0, 1.24, 0.03);
        group.add(bun);
        const bunTie = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 5, 8), cordMat);
        bunTie.position.set(0, 1.2, 0.03);
        bunTie.rotation.x = Math.PI / 2;
        group.add(bunTie);
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.24, 5), twigMat);
        twig.position.set(0.09, 1.27, 0.02);
        twig.rotation.z = -0.85;
        twig.rotation.x = 0.3;
        group.add(twig);
        for (let i = 0; i < 3; i++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 4), leafMat);
          leaf.position.set(0.155 + i * 0.028, 1.3 + i * 0.02, 0.02 - i * 0.01);
          leaf.rotation.z = -1.1;
          group.add(leaf);
        }

        // 臉側垂下的鬢髮，以及披在背後的長髮束。
        for (const side of [-1, 1]) {
          const strand = new THREE.Mesh(
            new THREE.ConeGeometry(0.028, 0.24, 5),
            hairMat,
          );
          strand.position.set(side * 0.185, 0.9, -0.02);
          strand.rotation.z = side * 0.12;
          group.add(strand);
        }
        for (let i = 0; i < 5; i++) {
          const t = i / 4 - 0.5;
          const len = 0.62 - Math.abs(t) * 0.14;
          const strand = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.014, len, 6),
            hairMat,
          );
          strand.position.set(t * 0.16, 1.0 - len / 2, 0.13 + Math.abs(t) * 0.01);
          strand.rotation.x = -0.05;
          strand.rotation.z = t * 0.08;
          group.add(strand);
        }

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.045, 5), skinMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.99, -0.195);
        group.add(nose);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), eyeMat);
          eye.scale.set(1, 0.75, 0.35);
          eye.position.set(side * 0.073, 1.03, -0.188);
          group.add(eye);
          const brow = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.01, 0.012), hairMat);
          brow.position.set(side * 0.073, 1.075, -0.192);
          group.add(brow);
        }
        addDefaultHumanoidSmile(group, 0.945, -0.201);

        function makeArm(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.235, 0.75, 0);
          const sleeve = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.06, 0.22, 7),
            kimonoMat,
          );
          sleeve.position.y = -0.1;
          pivot.add(sleeve);
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.01, 5, 8), innerMat);
          cuff.position.y = -0.205;
          cuff.rotation.x = Math.PI / 2;
          pivot.add(cuff);
          const forearm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.036, 0.042, 0.16, 6),
            skinMat,
          );
          forearm.position.y = -0.285;
          pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 7, 5), skinMat);
          hand.position.y = -0.385;
          pivot.add(hand);
          group.add(pivot);
          return pivot;
        }
        parts.armL = makeArm(-1);
        parts.armR = makeArm(1);

        function makeLeg(side) {
          const pivot = new THREE.Group();
          pivot.position.set(side * 0.105, 0.44, 0);
          const hakama = new THREE.Mesh(
            new THREE.CylinderGeometry(0.095, 0.075, 0.4, 7),
            hakamaMat,
          );
          hakama.position.y = -0.2;
          pivot.add(hakama);
          const ankleTie = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.011, 5, 8), cordMat);
          ankleTie.position.y = -0.345;
          ankleTie.rotation.x = Math.PI / 2;
          pivot.add(ankleTie);
          const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.2), bootMat);
          boot.position.set(0, -0.38, -0.035);
          boot.castShadow = true;
          pivot.add(boot);
          const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.02, 0.202), goldMat);
          bootTrim.position.set(0, -0.325, -0.035);
          pivot.add(bootTrim);
          group.add(pivot);
          return pivot;
        }
        parts.legL = makeLeg(-1);
        parts.legR = makeLeg(1);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.265));
        return group;
      }
      export function makeFemaleHeroPlayer() {
        return makeAdventurerHero(true);
      }
      export function makeHeroPlayer(appearance: "male" | "female" = "female") {
        const player = appearance === "male"
          ? makeMaleHeroPlayer()
          : makeFemaleHeroPlayer();
        player.userData.playerAppearance = appearance;
        return player;
      }
      function applyHeldItemPose(p: any) {
        p.armL.rotation.x = HELD_ARM_ROTATION.x;
        p.armR.rotation.x = HELD_ARM_ROTATION.x;
        p.armL.rotation.z = HELD_ARM_ROTATION.leftZ;
        p.armR.rotation.z = HELD_ARM_ROTATION.rightZ;
      }
      export function animateWalk(humanoid: any, moving, t) {
        const p = humanoid.parts;
        if (moving) {
          const swing = Math.sin(t * 10) * 0.5;
          p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
          if (humanoid.userData?.holdingItem) applyHeldItemPose(p);
          else { p.armL.rotation.x = -swing; p.armR.rotation.x = swing; p.armL.rotation.z = 0; p.armR.rotation.z = 0; }
          humanoid.position.y = Math.abs(Math.sin(t * 10)) * 0.03;
        } else {
          p.legL.rotation.x *= 0.8; p.legR.rotation.x *= 0.8;
          if (humanoid.userData?.holdingItem) applyHeldItemPose(p);
          else { p.armL.rotation.x *= 0.8; p.armR.rotation.x *= 0.8; p.armL.rotation.z *= 0.8; p.armR.rotation.z *= 0.8; }
          humanoid.position.y = Math.sin(t * 2) * 0.01;
        }
      }
      export function animateRun(humanoid: any, moving, t) {
        const p = humanoid.parts;
        if (moving) {
          const stride = Math.sin(t * 15) * 0.88;
          p.legL.rotation.x = stride; p.legR.rotation.x = -stride;
          if (humanoid.userData?.holdingItem) applyHeldItemPose(p);
          else { p.armL.rotation.x = -stride * 0.82; p.armR.rotation.x = stride * 0.82; p.armL.rotation.z = 0; p.armR.rotation.z = 0; }
          humanoid.rotation.x += (-0.1 - humanoid.rotation.x) * 0.22;
          humanoid.position.y = Math.abs(Math.sin(t * 15)) * 0.055;
        } else {
          p.legL.rotation.x *= 0.75; p.legR.rotation.x *= 0.75;
          if (humanoid.userData?.holdingItem) applyHeldItemPose(p);
          else { p.armL.rotation.x *= 0.75; p.armR.rotation.x *= 0.75; p.armL.rotation.z *= 0.75; p.armR.rotation.z *= 0.75; }
          humanoid.rotation.x *= 0.78; humanoid.position.y = Math.sin(t * 2) * 0.01;
        }
      }
      export function animateSit(humanoid: any) {
        const p = humanoid.parts;
        p.legL.rotation.x += (1.28 - p.legL.rotation.x) * 0.28; p.legR.rotation.x += (1.28 - p.legR.rotation.x) * 0.28;
        if (humanoid.userData?.holdingItem) applyHeldItemPose(p);
        else { p.armL.rotation.x *= 0.75; p.armR.rotation.x *= 0.75; p.armL.rotation.z += (-0.12 - p.armL.rotation.z) * 0.2; p.armR.rotation.z += (0.12 - p.armR.rotation.z) * 0.2; }
        humanoid.rotation.x *= 0.78; humanoid.position.y = -0.03;
      }
      export const FACING_ANGLE = {
        up: 0,
        down: Math.PI,
        left: Math.PI / 2,
        right: -Math.PI / 2,
      };

      // 現在腿是真的支點了，跟人形角色同一套邏輯：四足動物用「對角步」
      // (front-left + back-right 同步，跟 front-right + back-left 反相)，
      // 這是牛羊實際走路的步態，不是四隻腳一起同手同腳地滑稽亂動。
      // 雞只有兩隻腳，用左右交替，跟人的走路擺動邏輯一樣
      export function animateAnimalWalk(a: any, moving, t) {
        const p = a.mesh.parts;
        const freq = a.type === "chicken" ? 8 : 5;
        const amp = a.type === "chicken" ? 0.9 : 0.5;
        // 動物的「前」是本地 +X（頭接在 +X 那側），前後擺腿等於在 X-Y 平面裡動，
        // 要轉的是 Z 軸，不是 X 軸——轉 X 軸會在 Y-Z 平面動，那是身體左右張腿，
        // 跟人形角色的慣例（前=-Z，轉 X 軸才是前後）剛好相反，之前照抄錯了軸
        if (moving) {
          const swing = Math.sin(t * freq) * amp;
          if (a.type === "chicken") {
            p.legL.rotation.z = swing;
            p.legR.rotation.z = -swing;
          } else {
            p.legFL.rotation.z = swing;
            p.legBR.rotation.z = swing;
            p.legFR.rotation.z = -swing;
            p.legBL.rotation.z = -swing;
          }
          a.mesh.position.y =
            Math.abs(Math.sin(t * freq)) *
            (a.type === "chicken" ? 0.03 : 0.015);
        } else {
          Object.values(p).forEach((leg: any) => {
            leg.rotation.z *= 0.8;
          });
          a.mesh.position.y *= 0.8;
        }
      }

      // ==============================================================
