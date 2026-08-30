import { PLAYER } from "../config.js";

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export class AnimationController {
  constructor({ mixer, actions, bones = {} }) {
    this.mixer = mixer;
    this.actions = actions;
    this.bones = bones;
    this.mode = null;
    this.windup = 0;
    this.strike = 0;
    Object.values(actions).forEach((action) => {
      if (!action) return;
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
    });
    this.setState("idle", 0);
  }

  action(name) {
    const map = this.actions;
    if (name === "celebrate") return map.celebrate || map.idle;
    if (name === "slide") return map.slide || map.run || map.idle;
    if (name === "kick") return map.kick || map.run || map.idle;
    if (name === "jump") return map.jump || map.idle;
    if (name === "idle") return map.idle || map.walk;
    return map[name];
  }

  fadeOut(name, fade) {
    const action = this.action(name);
    if (action) action.fadeOut(fade);
  }

  fadeIn(name, fade) {
    const action = this.action(name);
    if (!action) return;
    action.reset().fadeIn(fade).play();
  }

  setState(name, fadeSeconds = 0.15) {
    if (name === this.mode) return;
    const prev = this.mode;
    this.mode = name;
    if (prev === "loco") {
      this.fadeOut("walk", fadeSeconds);
      this.fadeOut("run", fadeSeconds);
    } else if (prev) {
      this.fadeOut(prev, fadeSeconds);
    }
    if (name === "loco") {
      this.fadeIn("walk", fadeSeconds);
      this.fadeIn("run", fadeSeconds);
      return;
    }
    this.fadeIn(name, fadeSeconds);
  }

  updateLocoWeights(speed) {
    if (this.mode !== "loco") return;
    const t = clamp(speed / PLAYER.runSpeed, 0, 1);
    if (this.actions.walk) this.actions.walk.setEffectiveWeight(1 - t);
    if (this.actions.run) this.actions.run.setEffectiveWeight(t);
  }

  updateShootWeights(dt, state) {
    if (state.kicking) {
      this.strike = Math.min(1, this.strike + dt * 9);
      this.windup = Math.max(0, this.windup - dt * 8);
    } else if (state.charging) {
      const goal = 0.35 + clamp(state.charge ?? 0, 0, 1) * 0.65;
      this.windup += (goal - this.windup) * (1 - Math.exp(-10 * dt));
      this.strike = Math.max(0, this.strike - dt * 6);
    } else {
      this.windup = Math.max(0, this.windup - dt * 7);
      this.strike = Math.max(0, this.strike - dt * 7);
    }
  }

  applyShootPose() {
    const w = this.windup;
    const s = this.strike;
    if (w < 0.01 && s < 0.01) return;
    const b = this.bones;
    const rot = (name, x = 0, y = 0, z = 0) => {
      const bone = b[name];
      if (!bone) return;
      if (x) bone.rotateX(x);
      if (y) bone.rotateY(y);
      if (z) bone.rotateZ(z);
    };
    rot("Hips", 0.08 * w - 0.06 * s, 0.18 * w - 0.12 * s, 0);
    rot("Spine", -0.12 * w + 0.2 * s);
    rot("Spine1", -0.08 * w + 0.12 * s);
    rot("RightUpLeg", -1.15 * w + 1.4 * s, 0, 0.12 * w);
    rot("RightLeg", 0.95 * w + 0.25 * s);
    rot("RightFoot", 0.35 * w - 0.2 * s);
    rot("LeftUpLeg", 0.18 * w - 0.08 * s);
    rot("LeftLeg", 0.22 * w);
    rot("RightArm", 0.35 * w - 0.25 * s, 0, 0.4 * w);
    rot("RightForeArm", 0.45 * w);
    rot("LeftArm", -0.55 * w - 0.15 * s, 0, -0.25 * w);
    rot("LeftForeArm", 0.3 * w);
  }

  update(dt, state) {
    const shooting = state.kicking || state.charging;
    if (state.celebrating) this.setState("celebrate");
    else if (state.sliding) this.setState("slide");
    else if (shooting) this.setState(state.speed > 1.2 && !state.kicking ? "loco" : "idle");
    else if (!state.grounded) this.setState("jump");
    else if (state.speed > 0.4) this.setState("loco");
    else this.setState("idle");
    this.updateLocoWeights(state.speed);
    this.updateShootWeights(dt, state);
    this.mixer.update(dt);
    this.applyShootPose();
  }
}
