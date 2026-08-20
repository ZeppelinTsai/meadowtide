import * as THREE from "three";

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
        const skinMat = mat(0xb96f43), hairMat = mat(0x30241f);
        const jacketMat = mat(0x3f6266), shirtMat = mat(0xe7d7bd);
        const trouserMat = mat(0x874326), patchMat = mat(0x9b7651);
        const leatherMat = mat(0x4b3023), bootMat = mat(0x2f251f);
        const brassMat = mat(0xa8712d), redMat = mat(0xc84f32);
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

        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.08), leatherMat);
        pouch.position.set(-0.17, 0.43, -0.12); pouch.rotation.z = -0.08; group.add(pouch);
        const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.025), brassMat);
        ruler.position.set(-0.245, 0.45, -0.105); ruler.rotation.z = -0.1; group.add(ruler);
        const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 6), woodMat);
        hammerHandle.position.set(0.18, 0.43, -0.08); hammerHandle.rotation.z = -0.12; group.add(hammerHandle);
        const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.055), metalMat);
        hammerHead.position.set(0.165, 0.565, -0.08); group.add(hammerHead);
        const scarf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 3), redMat);
        scarf.position.set(0.235, 0.43, -0.025); scarf.rotation.z = -0.2; group.add(scarf);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8), skinMat);
        head.scale.set(0.92, 1.08, 0.92); head.position.y = 1.105;
        head.castShadow = true; group.add(head);
        const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.218, 9, 7), hairMat);
        hairCap.scale.set(1.04, 0.7, 1.03); hairCap.position.set(0, 1.225, 0.005); group.add(hairCap);
        [[-0.17,1.25,-0.08,-0.45],[-0.08,1.3,-0.1,-0.2],[0.03,1.31,-0.08,0.15],[0.14,1.27,-0.06,0.42],[0.18,1.18,-0.1,0.65]].forEach(([x,y,z,r]) => {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), hairMat);
          tuft.position.set(x,y,z); tuft.rotation.z = r; group.add(tuft);
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
          const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.043, 0.19, 7), skinMat);
          forearm.position.y = -0.33; pivot.add(forearm);
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), skinMat);
          hand.scale.set(0.85, 1.08, 0.8); hand.position.y = -0.45; pivot.add(hand);
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
          boot.position.set(0, -0.42, -0.04); pivot.add(boot); group.add(pivot); return pivot;
        }
        parts.legL = makeLeg(-1); parts.legR = makeLeg(1);

        const toolBox = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.21, 0.18), woodMat);
        box.position.set(0.1, -0.59, 0); box.castShadow = true; toolBox.add(box);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.2), leatherMat);
        lid.position.set(0.1, -0.465, 0); toolBox.add(lid);
        for (const x of [-0.04, 0.24]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.035), leatherMat);
          post.position.set(x, -0.385, 0); toolBox.add(post);
        }
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.035, 0.04), leatherMat);
        handle.position.set(0.1, -0.32, 0); toolBox.add(handle); parts.armL.add(toolBox);

        group.parts = parts;
        group.scale.setScalar(humanoidScale(1.39));
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
      // 目前正式入口使用女主角版本。
      export function makeHeroPlayer() {
        return makeAdventurerHero(true);
      }
      export function animateWalk(humanoid: any, moving, t) {
        const p = humanoid.parts;
        if (moving) {
          const swing = Math.sin(t * 10) * 0.5;
          p.legL.rotation.x = swing;
          p.legR.rotation.x = -swing;
          p.armL.rotation.x = -swing;
          p.armR.rotation.x = swing;
          humanoid.position.y = Math.abs(Math.sin(t * 10)) * 0.03;
        } else {
          p.legL.rotation.x *= 0.8;
          p.legR.rotation.x *= 0.8;
          p.armL.rotation.x *= 0.8;
          p.armR.rotation.x *= 0.8;
          humanoid.position.y = Math.sin(t * 2) * 0.01;
        }
      }
      export function animateRun(humanoid: any, moving, t) {
        const p = humanoid.parts;
        if (moving) {
          const stride = Math.sin(t * 15) * 0.88;
          p.legL.rotation.x = stride;
          p.legR.rotation.x = -stride;
          p.armL.rotation.x = -stride * 0.82;
          p.armR.rotation.x = stride * 0.82;
          humanoid.rotation.x += (-0.1 - humanoid.rotation.x) * 0.22;
          humanoid.position.y = Math.abs(Math.sin(t * 15)) * 0.055;
        } else {
          p.legL.rotation.x *= 0.75;
          p.legR.rotation.x *= 0.75;
          p.armL.rotation.x *= 0.75;
          p.armR.rotation.x *= 0.75;
          humanoid.rotation.x *= 0.78;
          humanoid.position.y = Math.sin(t * 2) * 0.01;
        }
      }
      export function animateSit(humanoid: any) {
        const p = humanoid.parts;
        p.legL.rotation.x += (1.28 - p.legL.rotation.x) * 0.28;
        p.legR.rotation.x += (1.28 - p.legR.rotation.x) * 0.28;
        p.armL.rotation.x *= 0.75;
        p.armR.rotation.x *= 0.75;
        p.armL.rotation.z += (-0.12 - p.armL.rotation.z) * 0.2;
        p.armR.rotation.z += (0.12 - p.armR.rotation.z) * 0.2;
        humanoid.rotation.x *= 0.78;
        humanoid.position.y = -0.03;
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
