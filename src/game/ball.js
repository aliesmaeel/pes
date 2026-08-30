import * as THREE from "three";
import { BALL } from "../config.js";

function ballTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#111827";
  const pent = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  pent(s / 2, s / 2, 28);
  pent(48, 48, 22);
  pent(208, 48, 22);
  pent(48, 208, 22);
  pent(208, 208, 22);
  pent(s / 2, 28, 16);
  pent(s / 2, 228, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBallMesh() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL.radius, 24, 18),
    new THREE.MeshStandardMaterial({
      map: ballTexture(),
      roughness: 0.35,
      metalness: 0.05,
    })
  );
  mesh.castShadow = true;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(BALL.radius * 1.15, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  mesh.add(shadow);
  shadow.position.y = -BALL.radius + 0.02;
  return mesh;
}
