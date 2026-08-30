import * as THREE from "three";
import { PITCH } from "../config.js";

export class MatchCamera {
  constructor(camera) {
    this.camera = camera;
    this.look = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 18, 26);
    this.shake = 0;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    camera.position.copy(this.pos);
  }

  punch(amount = 0.55) {
    if (!this.reduced) this.shake = Math.max(this.shake, amount);
  }

  update(dt, ball, focusPlayer) {
    const bx = THREE.MathUtils.clamp(ball.position.x, -PITCH.length / 2, PITCH.length / 2);
    const bz = THREE.MathUtils.clamp(ball.position.z, -PITCH.width / 2, PITCH.width / 2);
    const leadX = ball.velocity.x * 0.12;
    const targetLook = new THREE.Vector3(bx + leadX, 0.4, bz * 0.65);
    const targetPos = new THREE.Vector3(
      THREE.MathUtils.clamp(bx * 0.28 + leadX * 0.4, -12, 12),
      18.5,
      THREE.MathUtils.clamp(24 + Math.abs(bx) * 0.08, 22, 28)
    );
    if (focusPlayer) {
      targetLook.lerp(new THREE.Vector3(focusPlayer.position.x, 0.6, focusPlayer.position.z), 0.18);
    }

    const k = 1 - Math.exp(-3.2 * dt);
    this.look.lerp(targetLook, k);
    this.pos.lerp(targetPos, k);
    this.camera.position.copy(this.pos);
    if (this.shake > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
      this.shake *= Math.exp(-8 * dt);
    } else {
      this.shake = 0;
    }
    this.camera.lookAt(this.look);
  }
}
