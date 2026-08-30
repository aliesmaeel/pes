import { PLAYER } from "../config.js";

const STRIDE = 1.28;
const HIPS_Y = 0.92;
const TORSO_Y = 0.34;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export class Animator {
  constructor(parts) {
    this.p = parts;
    this.time = 0;
    this.distance = 0;
    this.kickBlend = 0;
    this.slideT = 0;
    this.recoverT = 0;
    this.loco = {
      lThigh: 0,
      rThigh: 0,
      lKnee: 0.04,
      rKnee: 0.04,
      lArm: 0,
      rArm: 0,
      lArmZ: 0.12,
      rArmZ: -0.12,
      hipsY: HIPS_Y,
      hipsX: 0,
      torsoX: 0,
      torsoY: 0,
    };
  }

  update(dt, state) {
    this.time += dt;
    const { hips, torso, leftArm, rightArm, leftLeg, rightLeg } = this.p;
    const speed = state.speed;
    const vy = state.vy ?? 0;

    if (state.grounded && speed > 0.12) this.distance += speed * dt;

    if (state.celebrating) {
      hips.rotation.x = 0;
      hips.position.y = HIPS_Y;
      torso.position.y = TORSO_Y;
      torso.rotation.z = Math.sin(this.time * 8) * 0.12;
      leftArm.shoulder.rotation.z = 2.4;
      rightArm.shoulder.rotation.z = -2.4;
      leftArm.shoulder.rotation.x = 0;
      rightArm.shoulder.rotation.x = 0;
      leftLeg.thigh.rotation.x = 0.1;
      rightLeg.thigh.rotation.x = -0.1;
      return;
    }

    if (state.sliding) {
      this.slideT = Math.min(1, this.slideT + dt / PLAYER.tackleDuration);
      this.recoverT = 0;
      const t = this.slideT;
      const slideEnd = 1;
      let drop = 0;
      let lean = 0;
      let extend = 0;
      let tuck = 0;
      let arms = 0;
      if (t < 0.2) {
        const p = t / 0.2;
        drop = p;
        lean = p * 0.2;
      } else if (t < slideEnd) {
        drop = 1;
        lean = 0.22;
        extend = 1;
        tuck = 1;
        arms = 1;
      }
      hips.rotation.x = -0.42 * drop;
      hips.position.y = HIPS_Y - 0.38 * drop;
      torso.position.y = TORSO_Y;
      torso.rotation.x = 0.28 * lean;
      rightLeg.thigh.rotation.x = -1.2 * extend;
      rightLeg.knee.rotation.x = 0.1 * extend;
      leftLeg.thigh.rotation.x = 0.72 * tuck;
      leftLeg.knee.rotation.x = 1.0 * tuck;
      leftArm.shoulder.rotation.x = -0.7 * arms;
      leftArm.shoulder.rotation.z = -0.38 * arms;
      rightArm.shoulder.rotation.x = -0.55 * arms;
      rightArm.shoulder.rotation.z = 0.32 * arms;
      return;
    }
    if (state.recovering) {
      this.slideT = 0;
      const rise = 1 - Math.min(1, state.recovering / PLAYER.standUpDuration);
      this.recoverT = rise;
      const drop = 1 - rise;
      const lean = 0.22 * drop;
      const extend = drop;
      const tuck = drop;
      const arms = drop;
      hips.rotation.x = -0.42 * drop;
      hips.position.y = HIPS_Y - 0.38 * drop;
      torso.position.y = TORSO_Y;
      torso.rotation.x = 0.28 * lean;
      rightLeg.thigh.rotation.x = -1.2 * extend;
      rightLeg.knee.rotation.x = 0.1 * extend;
      leftLeg.thigh.rotation.x = 0.72 * tuck;
      leftLeg.knee.rotation.x = 1.0 * tuck;
      leftArm.shoulder.rotation.x = -0.7 * arms;
      leftArm.shoulder.rotation.z = -0.38 * arms;
      rightArm.shoulder.rotation.x = -0.55 * arms;
      rightArm.shoulder.rotation.z = 0.32 * arms;
      return;
    }
    this.slideT = 0;
    this.recoverT = 0;

    const phase = (this.distance / STRIDE) * Math.PI * 2;
    const loc = this.loco;

    if (!state.grounded) {
      const up = vy > 0.12;
      const k = up ? 1 : 0;
      loc.lThigh = lerp(0.22, 0.82, k);
      loc.rThigh = lerp(0.12, 0.62, k);
      loc.lKnee = lerp(0.18, 0.7, k);
      loc.rKnee = lerp(0.14, 0.55, k);
      loc.lArm = lerp(-0.25, 0.75, k);
      loc.rArm = lerp(0.15, -0.55, k);
      loc.lArmZ = 0.18;
      loc.rArmZ = -0.18;
      loc.hipsY = HIPS_Y;
      loc.hipsX = up ? 0.08 : -0.06;
      loc.torsoX = up ? 0.06 : 0.16;
      loc.torsoY = 0;
    } else if (speed > 0.4) {
      const a = Math.sin(phase);
      const b = -a;
      loc.lThigh = a * 0.95;
      loc.rThigh = b * 0.95;
      loc.lKnee = Math.max(0, -a) * 0.85;
      loc.rKnee = Math.max(0, -b) * 0.85;
      loc.lArm = b * 0.7;
      loc.rArm = a * 0.7;
      loc.lArmZ = 0.15;
      loc.rArmZ = -0.15;
      loc.hipsY = HIPS_Y + Math.abs(a) * 0.03;
      loc.hipsX = 0;
      loc.torsoX = 0.12 + speed * 0.02;
      loc.torsoY = 0;
    } else {
      const breathe = Math.sin(this.time * 2.2) * 0.02;
      loc.lThigh = 0.04;
      loc.rThigh = -0.04;
      loc.lKnee = 0.04;
      loc.rKnee = 0.04;
      loc.lArm = 0.08;
      loc.rArm = -0.08;
      loc.lArmZ = 0.12;
      loc.rArmZ = -0.12;
      loc.hipsY = HIPS_Y + breathe;
      loc.hipsX = 0;
      loc.torsoX = 0;
      loc.torsoY = 0;
    }

    const kickGoal = state.kicking ? 1 : 0;
    this.kickBlend += (kickGoal - this.kickBlend) * (1 - Math.exp(-(state.kicking ? 18 : 14) * dt));
    if (this.kickBlend < 0.01 && !state.kicking) this.kickBlend = 0;

    const k = this.kickBlend;
    const swing = Math.sin(Math.min(1, k) * Math.PI);
    hips.position.y = loc.hipsY;
    hips.rotation.x = loc.hipsX;
    torso.position.y = TORSO_Y + loc.torsoY;
    torso.rotation.x = loc.torsoX;
    torso.rotation.y = lerp(0, -swing * 0.25, k);
    torso.rotation.z = 0;

    leftLeg.thigh.rotation.x = lerp(loc.lThigh, 0.25, k);
    rightLeg.thigh.rotation.x = lerp(loc.rThigh, -swing * 1.35, k);
    leftLeg.knee.rotation.x = lerp(loc.lKnee, 0.12, k);
    rightLeg.knee.rotation.x = lerp(loc.rKnee, swing * 0.5, k);
    leftArm.shoulder.rotation.x = lerp(loc.lArm, -swing * 0.4, k);
    rightArm.shoulder.rotation.x = lerp(loc.rArm, swing * 0.6, k);
    leftArm.shoulder.rotation.z = loc.lArmZ;
    rightArm.shoulder.rotation.z = loc.rArmZ;
  }
}
