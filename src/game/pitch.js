import * as THREE from "three";
import { PITCH } from "../config.js";

function grassTexture() {
  const w = 1024;
  const h = 672;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1f7a32" : "#246c30";
    ctx.fillRect((i / stripes) * w, 0, w / stripes + 1, h);
  }

  const toX = (x) => ((x + PITCH.length / 2) / PITCH.length) * w;
  const toY = (z) => ((z + PITCH.width / 2) / PITCH.width) * h;
  const line = (x1, z1, x2, z2) => {
    ctx.beginPath();
    ctx.moveTo(toX(x1), toY(z1));
    ctx.lineTo(toX(x2), toY(z2));
    ctx.stroke();
  };

  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  const L = PITCH.length / 2;
  const W = PITCH.width / 2;
  line(-L, -W, L, -W);
  line(-L, W, L, W);
  line(-L, -W, -L, W);
  line(L, -W, L, W);
  line(0, -W, 0, W);

  ctx.beginPath();
  ctx.arc(toX(0), toY(0), (9.15 / PITCH.length) * w, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 5, 0, Math.PI * 2);
  ctx.fill();

  const box = (sign) => {
    const px = sign * (L - 10);
    const six = sign * (L - 3.6);
    line(sign * L, -13, px, -13);
    line(px, -13, px, 13);
    line(px, 13, sign * L, 13);
    line(sign * L, -6.5, six, -6.5);
    line(six, -6.5, six, 6.5);
    line(six, 6.5, sign * L, 6.5);
    ctx.beginPath();
    ctx.arc(toX(sign * (L - 7.2)), toY(0), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(toX(sign * L), toY(-W), 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(toX(sign * L), toY(W), 22, 0, Math.PI * 2);
    ctx.stroke();
  };
  box(1);
  box(-1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function netTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(248,250,252,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 16) * 256, 0);
    ctx.lineTo((i / 16) * 256, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i / 16) * 256);
    ctx.lineTo(256, (i / 16) * 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function seeded(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function graffitiTexture(width, height, seed) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  const rand = seeded(seed);

  ctx.fillStyle = "#8d8678";
  ctx.fillRect(0, 0, width, height);
  const plaster = ctx.createLinearGradient(0, 0, 0, height);
  plaster.addColorStop(0, "#9a9488");
  plaster.addColorStop(0.55, "#7f786c");
  plaster.addColorStop(1, "#5e584e");
  ctx.fillStyle = plaster;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(${90 + rand() * 50},${82 + rand() * 40},${70 + rand() * 30},${0.04 + rand() * 0.1})`;
    ctx.fillRect(rand() * width, rand() * height, 8 + rand() * 70, 3 + rand() * 18);
  }
  ctx.strokeStyle = "rgba(40,36,30,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(rand() * width, rand() * height);
    ctx.lineTo(rand() * width, rand() * height);
    ctx.stroke();
  }

  const tags = [
    { text: "STRIKE", color: "#DC2626", outline: "#111827" },
    { text: "3D", color: "#2563EB", outline: "#f8fafc" },
    { text: "KICK", color: "#EAB308", outline: "#111827" },
    { text: "GOAL", color: "#22C55E", outline: "#052e16" },
    { text: "PES", color: "#7C3AED", outline: "#f8fafc" },
    { text: "RUN", color: "#F97316", outline: "#1c1917" },
    { text: "ACE", color: "#06B6D4", outline: "#083344" },
  ];

  const spray = (x, y, r, color, a = 0.28) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drip = (x, y, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + rand() * 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 8, y + 28 + rand() * 70);
    ctx.stroke();
  };

  const star = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * 0.42, y + Math.sin(b) * r * 0.42);
    }
    ctx.closePath();
    ctx.fill();
  };

  const ball = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  };

  const lightning = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18, y + 22);
    ctx.lineTo(x + 4, y + 22);
    ctx.lineTo(x + 22, y + 58);
    ctx.lineTo(x - 6, y + 30);
    ctx.lineTo(x + 8, y + 30);
    ctx.closePath();
    ctx.fill();
  };

  const arrow = (x, y, w, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - 10);
    ctx.lineTo(x + w - 8, y);
    ctx.lineTo(x + w, y + 10);
    ctx.closePath();
    ctx.fill();
  };

  for (let i = 0; i < 10; i++) {
    const colors = ["#DC2626", "#2563EB", "#22C55E", "#EAB308", "#7C3AED", "#F97316", "#06B6D4", "#F8FAFC"];
    spray(rand() * width, 40 + rand() * (height - 80), 50 + rand() * 90, colors[(i + seed) % colors.length], 0.2 + rand() * 0.22);
  }

  tags.forEach((tag, i) => {
    const x = 40 + ((i * 0.37 + rand() * 0.2) % 1) * (width - 220);
    const y = 70 + ((i * 0.51 + seed * 0.07) % 1) * (height - 130);
    const size = 42 + rand() * 38;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 0.28);
    ctx.font = `900 ${size}px Impact, Arial Black, sans-serif`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = tag.outline;
    ctx.fillStyle = tag.color;
    ctx.strokeText(tag.text, 0, 0);
    ctx.fillText(tag.text, 0, 0);
    drip(size * 0.4, 6, tag.color);
    drip(size * 1.1, 4, tag.color);
    ctx.restore();
  });

  for (let i = 0; i < 6; i++) {
    star(80 + rand() * (width - 160), 50 + rand() * (height - 90), 10 + rand() * 16, rand() > 0.5 ? "#EAB308" : "#F8FAFC");
  }
  for (let i = 0; i < 3; i++) {
    ball(60 + rand() * (width - 120), 70 + rand() * (height - 110), 16 + rand() * 10, "#F8FAFC");
  }
  lightning(80 + rand() * (width - 140), 40 + rand() * 80, "#EAB308");
  lightning(80 + rand() * (width - 140), 50 + rand() * 90, "#22C55E");
  arrow(40 + rand() * (width - 180), 80 + rand() * (height - 120), 70 + rand() * 40, "#2563EB");
  arrow(40 + rand() * (width - 180), 90 + rand() * (height - 130), 60, "#DC2626");

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#1c1917";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(rand() * width, rand() * height, 2, 2 + rand() * 8);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function ghostMaterials(materials, opacity = 0.16) {
  const list = Array.isArray(materials) ? materials : [materials];
  list.forEach((m) => {
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
    m.alphaTest = 0;
  });
}

function graffitiWallMaterials(width, height, seed, kind) {
  const map = graffitiTexture(width, height, seed);
  const face = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.86,
    metalness: 0.02,
  });
  const rim = new THREE.MeshStandardMaterial({ color: 0x6b645a, roughness: 0.92 });
  const top = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 });
  if (kind === "side") return [rim, rim, face, rim, face, face];
  return [face, face, face, rim, rim, rim];
}

export function createPitch(scene) {
  const group = new THREE.Group();
  const halfL = PITCH.length / 2;
  const halfW = PITCH.width / 2;

  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH.length + 8, PITCH.width + 8),
    new THREE.MeshStandardMaterial({
      map: grassTexture(),
      roughness: 0.92,
      metalness: 0.02,
    })
  );
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  group.add(field);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(PITCH.length + 28, PITCH.width + 24),
    new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 1 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  group.add(apron);

  const goal = (sign) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.15,
    });
    const post = (x, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, PITCH.goalHeight, 8), mat);
      m.position.set(x, PITCH.goalHeight / 2, z);
      m.castShadow = true;
      g.add(m);
    };
    post(sign * halfL, PITCH.goalWidth / 2);
    post(sign * halfL, -PITCH.goalWidth / 2);
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, PITCH.goalWidth + 0.14, 8),
      mat
    );
    bar.rotation.x = Math.PI / 2;
    bar.position.set(sign * halfL, PITCH.goalHeight, 0);
    g.add(bar);

    const netMat = new THREE.MeshBasicMaterial({
      map: netTexture(),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PITCH.goalWidth, PITCH.goalHeight),
      netMat
    );
    back.position.set(sign * (halfL + PITCH.goalDepth), PITCH.goalHeight / 2, 0);
    back.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(back);
    return g;
  };
  group.add(goal(1), goal(-1));

  const boardH = PITCH.wallHeight;
  const sideBoard = (z, seed, seeThrough = false) => {
    const mats = graffitiWallMaterials(2048, 512, seed, "side");
    if (seeThrough) ghostMaterials(mats, 0.14);
    const m = new THREE.Mesh(new THREE.BoxGeometry(PITCH.length + 0.4, boardH, PITCH.boardThickness), mats);
    m.position.set(0, boardH / 2, z);
    m.castShadow = !seeThrough;
    m.receiveShadow = !seeThrough;
    m.renderOrder = seeThrough ? 2 : 0;
    group.add(m);
    return m;
  };
  sideBoard(halfW + PITCH.boardCenterOffset, 11, true);
  sideBoard(-halfW - PITCH.boardCenterOffset, 29);

  const mural = (w, h, seed, x, y, z, rotY, lean = 0, seeThrough = false) => {
    const mat = new THREE.MeshStandardMaterial({
      map: graffitiTexture(Math.round(w * 36), 512, seed),
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.FrontSide,
    });
    if (seeThrough) ghostMaterials(mat, 0.12);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.rotation.x = lean;
    mesh.receiveShadow = !seeThrough;
    mesh.renderOrder = seeThrough ? 2 : 0;
    group.add(mesh);
    return mesh;
  };
  mural(PITCH.length + 0.2, boardH - 0.15, 71, 0, boardH / 2, halfW + 0.05, Math.PI, 0.16, true);
  mural(PITCH.length + 0.2, boardH - 0.15, 83, 0, boardH / 2, -halfW - 0.05, 0, -0.16);

  const endBoard = (sign) => {
    const wing = (halfW - PITCH.goalWidth / 2) / 2;
    const z = (PITCH.goalWidth / 2 + halfW) / 2;
    let n = 0;
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(PITCH.boardThickness, boardH, wing * 2 + 0.15),
        graffitiWallMaterials(768, 512, 40 + sign * 7 + n, "end")
      );
      m.position.set(sign * (halfL + PITCH.boardCenterOffset), boardH / 2, side * z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      mural(
        wing * 2,
        boardH - 0.15,
        90 + sign * 5 + n,
        sign * (halfL + 0.05),
        boardH / 2,
        side * z,
        sign > 0 ? -Math.PI / 2 : Math.PI / 2,
        0
      );
      n += 1;
    }
  };
  endBoard(1);
  endBoard(-1);

  const standMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 });
  const stand = new THREE.Mesh(new THREE.BoxGeometry(PITCH.length + 10, 8, 5.4), standMat);
  stand.position.set(0, 5.6, halfW + 8.2);
  group.add(stand);
  const stand2 = stand.clone();
  stand2.position.z = -halfW - 8.2;
  group.add(stand2);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(PITCH.length + 8, 0.35, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
  );
  deck.position.set(0, 4.4, halfW + 4.8);
  group.add(deck);
  const deck2 = deck.clone();
  deck2.position.z = -halfW - 4.8;
  group.add(deck2);

  const crowdGeo = new THREE.BoxGeometry(0.28, 0.55, 0.28);
  const crowdMat = new THREE.MeshStandardMaterial({ vertexColors: true });
  const count = 420;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0xdc2626, 0x2563eb, 0xf8fafc, 0x22c55e, 0xeab308, 0x7c3aed];
  let i = 0;
  for (const side of [1, -1]) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 52 && i < count; c++, i++) {
        dummy.position.set(-PITCH.length / 2 + 1 + c * 1.02, 5.8 + r * 0.85, side * (halfW + 4.2 + r * 0.7));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
        color.setHex(palette[(c + r) % palette.length]);
        crowd.setColorAt(i, color);
      }
    }
  }
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  group.add(crowd);

  const lightPole = (x, z) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    pole.position.set(x, 5, z);
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.25, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfbbf24, emissiveIntensity: 1.4 })
    );
    lamp.position.set(x, 10.1, z);
    group.add(lamp);
  };
  lightPole(halfL + 2, halfW + 3);
  lightPole(-halfL - 2, halfW + 3);
  lightPole(halfL + 2, -halfW - 3);
  lightPole(-halfL - 2, -halfW - 3);

  scene.add(group);
  return { group, crowd };
}

export function createLights(scene) {
  scene.background = new THREE.Color(0x0c1b2e);
  scene.fog = new THREE.Fog(0x0c1b2e, 52, 120);

  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x1a5c2e, 0.95);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4d6, 1.7);
  key.position.set(18, 28, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -36;
  key.shadow.camera.right = 36;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x93c5fd, 0.7);
  fill.position.set(-20, 16, -12);
  scene.add(fill);

  const spots = [
    [24, 16, 18],
    [-24, 16, 18],
    [24, 16, -18],
    [-24, 16, -18],
  ];
  spots.forEach(([x, y, z]) => {
    const s = new THREE.SpotLight(0xfff7d6, 18, 55, 0.55, 0.45, 1);
    s.position.set(x, y, z);
    s.target.position.set(x * 0.2, 0, z * 0.15);
    scene.add(s, s.target);
  });
}
