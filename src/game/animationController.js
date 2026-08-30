import { PLAYER } from "../config.js";

const ONE_SHOTS = new Set(["kick", "pass", "jump", "celebrate", "standUp", "slide"]);
const GROUND_LOCKED = new Set(["kick", "pass"]);

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
    this.passT = 0;
    this.slideT = 0;
    this.slideDropY = 0;
    this._poseSnap = null;
    this._wasSliding = false;
    this._wasKicking = false;
    this._wasCharging = false;
    this._wasPassing = false;
    this._wasGrounded = true;
    this._wasCelebrating = false;
    this._recoverDrop = 0;
    this._groundHips = null;
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
    if (name === "kick") return map.kick || map.idle;
    if (name === "pass") return map.pass || map.idle;
    if (name === "jump") return map.jump || map.idle;
    if (name === "standUp") return map.standUp || map.idle;
    if (name === "slide") return map.slide || map.idle;
    if (name === "idle") return map.idle || map.walk;
    return map[name];
  }

  fadeOut(name, fade) {
    const action = this.action(name);
    if (!action || action.getEffectiveWeight() <= 0) return;
    action.weight = Math.max(action.weight, action.getEffectiveWeight());
    action.fadeOut(fade);
  }

  fadeIn(name, fade) {
    const action = this.action(name);
    if (!action) return;
    action.enabled = true;
    action.weight = 1;
    action.reset().fadeIn(fade).play();
  }

  playOneShot(name, fitDuration) {
    const action = this.action(name);
    if (!action || !ONE_SHOTS.has(name)) return;
    const fade = 0.08;
    for (const [key, other] of Object.entries(this.actions)) {
      if (!other || key === name) continue;
      if (key === "walk" || key === "run") this.fadeOut(key, fade);
      else if (key === this.mode) this.fadeOut(key, fade);
      else other.setEffectiveWeight(0);
    }
    action.enabled = true;
    action.reset();
    action.paused = false;
    action.setEffectiveWeight(1);
    const duration = action.getClip()?.duration;
    if (fitDuration && duration) {
      action.timeScale = clamp(duration / fitDuration, 1, 2.4);
    } else {
      action.timeScale = 1;
    }
    action.play();
    this.mode = name;
    if (GROUND_LOCKED.has(name)) {
      const hips = this.bones.Hips;
      this._groundHips = hips
        ? { quaternion: hips.quaternion.clone(), position: hips.position.clone() }
        : null;
    } else {
      this._groundHips = null;
    }
  }

  lockGroundHips() {
    if (!this._groundHips || !GROUND_LOCKED.has(this.mode)) return;
    const hips = this.bones.Hips;
    if (!hips) return;
    hips.quaternion.copy(this._groundHips.quaternion);
    hips.position.copy(this._groundHips.position);
  }

  setState(name, fadeSeconds = 0.15) {
    if (name === this.mode) return;
    const prev = this.mode;
    const prevAction = prev ? this.action(prev) : null;
    const nextAction = this.action(name);
    if (prevAction && nextAction && prevAction === nextAction) {
      this.mode = name;
      return;
    }

    this.mode = name;

    if (ONE_SHOTS.has(name)) {
      const fit =
        name === "kick"
          ? 0.35
          : name === "pass"
            ? 0.55
            : name === "standUp"
              ? PLAYER.standUpDuration
              : name === "slide"
                ? PLAYER.tackleDuration
                : undefined;
      this.playOneShot(name, fit);
      return;
    }

    if (prev === "loco") {
      this.fadeOut("walk", fadeSeconds);
      this.fadeOut("run", fadeSeconds);
    } else if (prev && !ONE_SHOTS.has(prev)) {
      this.fadeOut(prev, fadeSeconds);
    } else if (prev) {
      const leaving = this.action(prev);
      if (leaving) leaving.setEffectiveWeight(0);
    }

    if (name === "loco") {
      this.fadeIn("walk", fadeSeconds);
      this.fadeIn("run", fadeSeconds);
      return;
    }

    if (!GROUND_LOCKED.has(name)) this._groundHips = null;
    this.fadeIn(name, fadeSeconds);
    if (fadeSeconds <= 0) {
      const action = this.action(name);
      if (action) action.setEffectiveWeight(1);
    }
  }

  capturePoseSnapshot() {
    this._poseSnap = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      if (!bone?.quaternion) continue;
      this._poseSnap[name] = {
        q: bone.quaternion.clone(),
        p: bone.position.clone(),
      };
    }
  }

  restorePoseSnapshot() {
    if (!this._poseSnap) return;
    for (const [name, bone] of Object.entries(this.bones)) {
      const snap = this._poseSnap[name];
      if (!snap) continue;
      bone.quaternion.copy(snap.q);
      bone.position.copy(snap.p);
    }
  }

  setRel(name, x = 0, y = 0, z = 0) {
    const bone = this.bones[name];
    if (!bone) return;
    if (x) bone.rotateX(x);
    if (y) bone.rotateY(y);
    if (z) bone.rotateZ(z);
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
    if (state.passing) this.passT = Math.min(1, this.passT + dt * 4.2);
    else this.passT = Math.max(0, this.passT - dt * 5);
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

  applyPassPose(t) {
    if (t <= 0.01) return;
    const b = this.bones;
    const rot = (name, x = 0, y = 0, z = 0) => {
      const bone = b[name];
      if (!bone) return;
      if (x) bone.rotateX(x);
      if (y) bone.rotateY(y);
      if (z) bone.rotateZ(z);
    };
    const wind = Math.max(0, 1 - t * 1.6);
    const strike = Math.min(1, t * 1.35);
    rot("Hips", 0.12 * strike, 0.42 * strike - 0.1 * wind, 0.06 * strike);
    rot("Spine", 0.18 * strike, 0.22 * strike);
    rot("Spine1", 0.1 * strike, 0.12 * strike);
    rot("RightUpLeg", -0.45 * wind + 1.05 * strike, 0.38 * strike, 0.22 * strike);
    rot("RightLeg", 0.5 * wind + 0.35 * strike);
    rot("RightFoot", 0.2 * wind + 0.15 * strike, 0.25 * strike);
    rot("LeftUpLeg", 0.28 * strike);
    rot("LeftLeg", 0.2 * strike);
    rot("LeftArm", -0.75 * strike, 0, -0.2 * strike);
    rot("RightArm", 0.35 * strike, 0, 0.45 * strike);
    rot("RightForeArm", 0.25 * strike);
  }

  applySlidePose(t) {
    if (t <= 0 || !this._poseSnap) {
      this.slideDropY = 0;
      return;
    }

    this.restorePoseSnapshot();

    const hasStandUp = !!this.actions.standUp;
    const slideEnd = hasStandUp ? 1 : 0.82;

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
    } else {
      const p = (t - 0.82) / 0.18;
      drop = 1 - p;
      lean = 0.22 * (1 - p);
      extend = 1 - p;
      tuck = 1 - p;
      arms = 1 - p;
    }

    this.slideDropY = -0.52 * drop;

    this.setRel("Hips", -0.42 * drop, 0, 0);
    this.setRel("Spine", 0.28 * lean, 0, 0);
    this.setRel("Spine1", 0.2 * lean, 0, 0);
    this.setRel("Spine2", 0.12 * lean, 0, 0);
    this.setRel("RightUpLeg", -1.2 * extend, 0, 0.1 * extend);
    this.setRel("RightLeg", 0.1 * extend, 0, 0);
    this.setRel("RightFoot", 0.06 * extend, 0, 0);
    this.setRel("LeftUpLeg", 0.72 * tuck, 0, 0);
    this.setRel("LeftLeg", 1.0 * tuck, 0, 0);
    this.setRel("LeftFoot", 0.18 * tuck, 0, 0);
    this.setRel("LeftArm", -0.7 * arms, 0, -0.38 * arms);
    this.setRel("LeftForeArm", 0.22 * arms, 0, 0);
    this.setRel("RightArm", -0.55 * arms, 0, 0.32 * arms);
    this.setRel("RightForeArm", 0.18 * arms, 0, 0);
  }

  applyStandUpPose(t) {
    if (t <= 0 || !this._poseSnap) return;
    this.restorePoseSnapshot();
    const p = clamp(t, 0, 1);
    const drop = 1 - p;
    const lean = 0.22 * drop;
    const extend = drop;
    const tuck = drop;
    const arms = drop;
    this.slideDropY = -0.52 * drop;
    this.setRel("Hips", -0.42 * drop, 0, 0);
    this.setRel("Spine", 0.28 * lean, 0, 0);
    this.setRel("Spine1", 0.2 * lean, 0, 0);
    this.setRel("Spine2", 0.12 * lean, 0, 0);
    this.setRel("RightUpLeg", -1.2 * extend, 0, 0.1 * extend);
    this.setRel("RightLeg", 0.1 * extend, 0, 0);
    this.setRel("RightFoot", 0.06 * extend, 0, 0);
    this.setRel("LeftUpLeg", 0.72 * tuck, 0, 0);
    this.setRel("LeftLeg", 1.0 * tuck, 0, 0);
    this.setRel("LeftFoot", 0.18 * tuck, 0, 0);
    this.setRel("LeftArm", -0.7 * arms, 0, -0.38 * arms);
    this.setRel("LeftForeArm", 0.22 * arms, 0, 0);
    this.setRel("RightArm", -0.55 * arms, 0, 0.32 * arms);
    this.setRel("RightForeArm", 0.18 * arms, 0, 0);
  }

  applyJumpPose(vy = 0) {
    const rising = vy > 0.1 ? 1 : 0.45;
    const b = this.bones;
    const rot = (name, x = 0, y = 0, z = 0) => {
      const bone = b[name];
      if (!bone) return;
      if (x) bone.rotateX(x);
      if (y) bone.rotateY(y);
      if (z) bone.rotateZ(z);
    };
    rot("Hips", -0.08 * rising);
    rot("LeftUpLeg", 0.72 * rising);
    rot("RightUpLeg", 0.55 * rising);
    rot("LeftLeg", 0.85 * rising);
    rot("RightLeg", 0.7 * rising);
    rot("LeftArm", 0.65 * rising, 0, -0.25);
    rot("RightArm", -0.45 * rising, 0, 0.25);
  }

  update(dt, state) {
    const useSlideClip = !!this.actions.slide;

    if (state.sliding && !this._wasSliding) {
      if (!useSlideClip) this.capturePoseSnapshot();
      this.slideT = 0;
      if (useSlideClip) this.playOneShot("slide", PLAYER.tackleDuration);
    }
    if (state.sliding) {
      if (!useSlideClip) {
        this.slideT = Math.min(1, this.slideT + dt / PLAYER.tackleDuration);
      }
    } else if (!state.recovering) {
      this.slideT = 0;
      if (!this.actions.standUp) this.slideDropY = 0;
    }

    if (this._wasSliding && !state.sliding && this.actions.standUp) {
      this._recoverDrop = this.slideDropY || -0.52;
      this.playOneShot("standUp", PLAYER.standUpDuration);
    }

    if (this.actions.kick && state.kicking && !this._wasKicking) {
      this.playOneShot("kick", 0.35);
    } else if (this.actions.pass && state.passing && !this._wasPassing) {
      this.playOneShot("pass", 0.55);
    } else if (this.actions.jump && !state.grounded && this._wasGrounded && !state.sliding && !state.recovering) {
      this.playOneShot("jump");
    } else if (state.celebrating && !this._wasCelebrating) {
      this.playOneShot("celebrate");
    }

    if (state.celebrating) this.setState("celebrate");
    else if (state.sliding) {
      if (useSlideClip) {
        if (this.mode !== "slide") this.setState("slide");
      } else if (state.speed > 0.4) {
        this.setState("loco");
      } else {
        this.setState("idle");
      }
    } else if (state.recovering && this.actions.standUp) {
      if (this.mode !== "standUp") this.setState("standUp");
    } else if (state.recovering) {
      if (state.speed > 0.4) this.setState("loco");
      else this.setState("idle");
    } else if (state.passing) this.setState(this.actions.pass ? "pass" : "idle");
    else if (state.kicking) this.setState(this.actions.kick ? "kick" : "idle");
    else if (!state.grounded) this.setState("jump");
    else if (state.speed > 0.4) this.setState("loco");
    else this.setState("idle");

    this._wasSliding = state.sliding;
    this._wasKicking = state.kicking;
    this._wasCharging = state.charging;
    this._wasPassing = state.passing;
    this._wasGrounded = state.grounded;
    this._wasCelebrating = state.celebrating;

    this.updateLocoWeights(state.speed);
    this.updateShootWeights(dt, state);
    this.mixer.update(dt);
    this.lockGroundHips();

    if (state.sliding && !this.actions.slide) {
      this.applySlidePose(this.slideT);
    } else if (state.recovering && this.actions.standUp) {
      const rise = 1 - clamp(state.recovering / PLAYER.standUpDuration, 0, 1);
      this.slideDropY = this._recoverDrop * (1 - rise);
    } else if (state.recovering && !this.actions.standUp) {
      const rise = 1 - clamp(state.recovering / PLAYER.standUpDuration, 0, 1);
      this.applyStandUpPose(rise);
    } else if (!state.recovering) {
      this.slideDropY = 0;
    }

    if (!this.actions.pass) this.applyPassPose(this.passT);
    if (state.charging) this.applyShootPose();
    else if (!this.actions.kick && !state.passing && !state.recovering) this.applyShootPose();
    if (
      !this.actions.jump &&
      !state.grounded &&
      !state.sliding &&
      !state.recovering &&
      !state.kicking &&
      !state.charging &&
      !state.passing
    ) {
      this.applyJumpPose(state.vy);
    }
  }
}
