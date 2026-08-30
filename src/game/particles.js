import * as THREE from "three";

export class Burst {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.BufferGeometry();
    const n = 80;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = [];
    this.life = 0;
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.18, transparent: true, opacity: 1, depthWrite: false })
    );
    this.points.visible = false;
    scene.add(this.points);
  }

  spawn(x, y, z, color = 0xf8fafc) {
    this.points.material.color.setHex(color);
    this.life = 1;
    this.points.visible = true;
    this.points.material.opacity = 1;
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i] = {
        x: (Math.random() - 0.5) * 10,
        y: Math.random() * 8 + 2,
        z: (Math.random() - 0.5) * 10,
      };
    }
    this.geo.attributes.position.needsUpdate = true;
  }

  update(dt) {
    if (this.life <= 0) {
      this.points.visible = false;
      return;
    }
    this.life -= dt * 0.85;
    for (let i = 0; i < this.n; i++) {
      this.vel[i].y -= 14 * dt;
      this.pos[i * 3] += this.vel[i].x * dt;
      this.pos[i * 3 + 1] += this.vel[i].y * dt;
      this.pos[i * 3 + 2] += this.vel[i].z * dt;
    }
    this.points.material.opacity = Math.max(0, this.life);
    this.geo.attributes.position.needsUpdate = true;
  }
}
