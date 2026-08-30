import * as THREE from "three";
import { PLAYER } from "../config.js";
import { createPlayerMesh } from "./mesh.js";
import { Animator } from "./animator.js";

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Player {
  constructor({ body, team, kit, number, role, human, pad }) {
    this.body = body;
    this.team = team;
    this.role = role;
    this.human = human;
    this.pad = pad ?? 0;
    this.number = number;
    this.parts = createPlayerMesh({ kit, number });
    this.mesh = this.parts.root;
    this.anim = new Animator(this.parts);
    this.stamina = PLAYER.staminaMax;
    this.charge = 0;
    this.charging = false;
    this.facing = team === "home" ? Math.PI / 2 : -Math.PI / 2;
    this.grounded = true;
    this.sliding = 0;
    this.tackleCd = 0;
    this.kickLock = 0;
    this.stun = 0;
    this.celebrating = false;
    this.lastShot = 0;
    this.wishX = 0;
    this.wishZ = 0;
    this.whiffing = 0;
    this.home = new THREE.Vector3();
  }

  get position() {
    return this.body.position;
  }

  speed() {
    const v = this.body.velocity;
    return Math.hypot(v.x, v.z);
  }

  faceDir() {
    return { x: Math.sin(this.facing), z: Math.cos(this.facing) };
  }

  reset(x, z, faceHomeGoal) {
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.position.set(x, 0, z);
    this.home.set(x, 0, z);
    this.stamina = PLAYER.staminaMax;
    this.charge = 0;
    this.charging = false;
    this.sliding = 0;
    this.tackleCd = 0;
    this.kickLock = 0;
    this.stun = 0;
    this.celebrating = false;
    this.whiffing = 0;
    this.wishX = 0;
    this.wishZ = 0;
    this.facing = faceHomeGoal ? Math.PI / 2 : -Math.PI / 2;
    this.mesh.rotation.y = this.facing;
  }

  aimDir() {
    const len = Math.hypot(this.wishX, this.wishZ);
    if (len > 0.15) return { x: this.wishX / len, z: this.wishZ / len };
    return this.faceDir();
  }

  applyInput(input, camera, dt) {
    if (this.stun > 0 || this.sliding > 0) return { wishX: 0, wishZ: 0, sprinting: false };
    _fwd.set(0, 0, 0);
    camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 0.0001) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, _up).normalize();
    _wish.set(0, 0, 0);
    _wish.addScaledVector(_right, input.move.x);
    _wish.addScaledVector(_fwd, input.move.z);
    if (_wish.lengthSq() > 1) _wish.normalize();
    return {
      wishX: _wish.x,
      wishZ: _wish.z,
      sprinting: input.sprint && this.stamina > 4,
    };
  }

  move(wishX, wishZ, sprinting, dt, hasBall = false) {
    this.wishX = wishX;
    this.wishZ = wishZ;
    const base = sprinting ? PLAYER.sprintSpeed : PLAYER.runSpeed;
    const max = base * (hasBall ? PLAYER.onBallSpeed : 1);
    const v = this.body.velocity;
    if (this.sliding > 0) {
      this.sliding -= dt;
      return;
    }
    if (this.stun > 0) {
      this.stun -= dt;
      v.x *= 0.86;
      v.z *= 0.86;
      return;
    }

    const t = 1 - Math.exp(-10 * dt);
    v.x += (wishX * max - v.x) * t;
    v.z += (wishZ * max - v.z) * t;

    const horiz = Math.hypot(v.x, v.z);
    if (horiz > max) {
      v.x = (v.x / horiz) * max;
      v.z = (v.z / horiz) * max;
    }

    if (sprinting && horiz > 1) this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    else this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRegen * dt);

    if (Math.hypot(wishX, wishZ) > 0.2) this.facing = Math.atan2(wishX, wishZ);
    else if (horiz > 0.6) this.facing = Math.atan2(v.x, v.z);
    this.tackleCd = Math.max(0, this.tackleCd - dt);
    this.kickLock = Math.max(0, this.kickLock - dt);
    this.whiffing = Math.max(0, this.whiffing - dt);
    this.grounded = this.body.position.y < 0.12 && v.y <= 0.4;
  }

  jump() {
    if (!this.grounded || this.sliding > 0 || this.stun > 0) return false;
    this.body.velocity.y = PLAYER.jumpSpeed;
    this.grounded = false;
    return true;
  }

  tackle() {
    if (this.tackleCd > 0 || this.sliding > 0 || this.stun > 0 || !this.grounded) return false;
    const dir = this.aimDir();
    this.body.velocity.x = dir.x * PLAYER.tackleSpeed;
    this.body.velocity.z = dir.z * PLAYER.tackleSpeed;
    this.sliding = PLAYER.tackleDuration;
    this.tackleCd = PLAYER.tackleCooldown;
    return true;
  }

  startCharge() {
    if (this.sliding > 0) return;
    this.charging = true;
    this.charge = 0;
  }

  tickCharge(dt) {
    if (this.charging) this.charge = Math.min(PLAYER.kickChargeMax, this.charge + dt);
  }

  releaseKick() {
    if (!this.charging) return null;
    const charge = this.charge / PLAYER.kickChargeMax;
    this.charging = false;
    this.charge = 0;
    this.kickLock = 0.35;
    this.lastShot += 1;
    return charge;
  }

  sync(dt, controlled) {
    const p = this.body.position;
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, this.facing, 1 - Math.exp(-12 * dt));
    this.parts.marker.visible = !!controlled;
    this.parts.selectRing.visible = !!controlled;
    this.parts.charge.visible = this.charging;
    if (this.charging) {
      const s = 0.7 + (this.charge / PLAYER.kickChargeMax) * 0.8;
      this.parts.charge.scale.set(s, s, s);
    }
    this.anim.update(dt, {
      speed: this.speed(),
      grounded: this.grounded,
      kicking: this.kickLock > 0.12,
      sliding: this.sliding > 0,
      celebrating: this.celebrating,
    });
  }
}
