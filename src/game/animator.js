export class Animator {
  constructor(parts) {
    this.p = parts;
    this.time = 0;
    this.kickT = 0;
    this.slideT = 0;
  }

  update(dt, state) {
    this.time += dt;
    const { hips, torso, head, leftArm, rightArm, leftLeg, rightLeg } = this.p;
    const speed = state.speed;
    const run = this.time * (7 + speed * 1.6);

    if (state.celebrating) {
      hips.rotation.x = 0;
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
      this.slideT = Math.min(1, this.slideT + dt * 6);
      hips.rotation.x = this.slideT * 1.15;
      hips.position.y = 0.55;
      rightLeg.thigh.rotation.x = 0.9;
      leftLeg.thigh.rotation.x = -0.2;
      rightArm.shoulder.rotation.x = -0.8;
      leftArm.shoulder.rotation.x = 0.4;
      return;
    }
    this.slideT = 0;
    hips.position.y = 0.92;
    hips.rotation.x = 0;

    if (state.kicking) {
      this.kickT = Math.min(1, this.kickT + dt * 7);
      const swing = Math.sin(this.kickT * Math.PI);
      rightLeg.thigh.rotation.x = -swing * 1.35;
      rightLeg.knee.rotation.x = swing * 0.5;
      leftLeg.thigh.rotation.x = 0.25;
      rightArm.shoulder.rotation.x = swing * 0.6;
      leftArm.shoulder.rotation.x = -swing * 0.4;
      torso.rotation.y = -swing * 0.25;
      return;
    }
    this.kickT = 0;
    torso.rotation.y = 0;

    if (!state.grounded) {
      leftLeg.thigh.rotation.x = 0.55;
      rightLeg.thigh.rotation.x = 0.35;
      leftLeg.knee.rotation.x = 0.45;
      rightLeg.knee.rotation.x = 0.35;
      leftArm.shoulder.rotation.x = 0.7;
      rightArm.shoulder.rotation.x = -0.5;
      return;
    }

    if (speed > 0.4) {
      const a = Math.sin(run);
      const b = -a;
      leftLeg.thigh.rotation.x = a * 0.95;
      rightLeg.thigh.rotation.x = b * 0.95;
      leftLeg.knee.rotation.x = Math.max(0, -a) * 0.85;
      rightLeg.knee.rotation.x = Math.max(0, -b) * 0.85;
      leftArm.shoulder.rotation.x = b * 0.7;
      rightArm.shoulder.rotation.x = a * 0.7;
      leftArm.shoulder.rotation.z = 0.15;
      rightArm.shoulder.rotation.z = -0.15;
      torso.rotation.x = 0.12 + speed * 0.02;
      hips.position.y = 0.92 + Math.abs(a) * 0.03;
    } else {
      const breathe = Math.sin(this.time * 2.2) * 0.02;
      torso.position.y = 0.34 + breathe;
      leftLeg.thigh.rotation.x = 0.04;
      rightLeg.thigh.rotation.x = -0.04;
      leftLeg.knee.rotation.x = 0.04;
      rightLeg.knee.rotation.x = 0.04;
      leftArm.shoulder.rotation.x = 0.08;
      rightArm.shoulder.rotation.x = -0.08;
      leftArm.shoulder.rotation.z = 0.12;
      rightArm.shoulder.rotation.z = -0.12;
      torso.rotation.x = 0;
    }
  }
}
