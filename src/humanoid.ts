import * as THREE from "three";

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
        return group;
      }

      // 可愛女孩角色 — parts 結構(armL/armR/legL/legR)跟 makeHumanoid 完全一致，
      // 所以 animateWalk() / FACING_ANGLE 那套邏輯不用改一行，純粹是外觀差異
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
        return group;
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
