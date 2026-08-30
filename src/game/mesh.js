import * as THREE from "three";

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, ...extras });
}

function box(w, h, d, color, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.y = y;
  m.castShadow = true;
  return m;
}

export function createPlayerMesh({ kit, number, skin = 0xc68642 }) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  const torso = box(0.46, 0.52, 0.28, kit.jersey, 0.34);
  hips.add(torso);
  const collar = box(0.3, 0.08, 0.22, kit.trim, 0.62);
  hips.add(collar);

  const head = new THREE.Group();
  head.position.y = 0.78;
  hips.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(skin));
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8), mat(0x1c1917));
  hair.scale.set(1, 0.7, 1.05);
  hair.position.set(0, 0.06, -0.01);
  head.add(hair);

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.28, 0.52, 0);
    hips.add(shoulder);
    const upper = box(0.12, 0.28, 0.12, kit.jersey, -0.14);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(box(0.1, 0.26, 0.1, skin, -0.12));
    return { shoulder, elbow };
  };

  const makeLeg = (side) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.12, 0, 0);
    hips.add(thigh);
    thigh.add(box(0.16, 0.36, 0.16, kit.shorts, -0.18));
    const knee = new THREE.Group();
    knee.position.y = -0.38;
    thigh.add(knee);
    knee.add(box(0.14, 0.34, 0.14, kit.socks, -0.16));
    const boot = box(0.16, 0.08, 0.26, 0x111827, -0.36);
    boot.position.z = 0.05;
    knee.add(boot);
    return { thigh, knee };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px Orbitron, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 32, 34);
  const numTex = new THREE.CanvasTexture(canvas);
  const num = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true })
  );
  num.position.set(0, 0.34, -0.145);
  hips.add(num);

  const overlays = attachPlayerOverlays(root, { number, markerY: 2.35 });

  return {
    root,
    hips,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    ...overlays,
  };
}

export function attachPlayerOverlays(root, { number, markerY = 2.15 } = {}) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.32, 4),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  marker.position.y = markerY;
  marker.rotation.x = Math.PI;
  marker.visible = false;
  root.add(marker);

  const selectRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 28),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  selectRing.rotation.x = -Math.PI / 2;
  selectRing.position.y = 0.05;
  selectRing.visible = false;
  root.add(selectRing);

  const passTarget = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.64, 28),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
  );
  passTarget.rotation.x = -Math.PI / 2;
  passTarget.position.y = 0.06;
  passTarget.visible = false;
  root.add(passTarget);

  const charge = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 28),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
  );
  charge.rotation.x = -Math.PI / 2;
  charge.position.y = 0.1;
  charge.visible = false;
  root.add(charge);

  return { marker, selectRing, passTarget, charge, shadow };
}
