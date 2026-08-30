import * as THREE from "three";
import { BALL, DIFFICULTY, KITS, MATCH, PITCH, PLAYER } from "../config.js";
import { thinkAI } from "./ai.js";
import { createBallMesh } from "./ball.js";
import { MatchCamera } from "./camera.js";
import { Input } from "./input.js";
import { Burst } from "./particles.js";
import { createLights, createPitch } from "./pitch.js";
import { clampInsideBoards, fieldLimit } from "./pitchBounds.js";
import { createBallBody, createPhysics, createPlayerBody, GROUP_BALL, GROUP_PLAYER, GROUP_WORLD } from "./physics.js";
import { Player } from "./player.js";

function dist(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

const STORAGE = "strike3d-career";

export function loadCareer() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || "");
    if (data && typeof data.wins === "number") return data;
  } catch {
    /* keep default */
  }
  return { wins: 0, losses: 0, kitHome: "crimson", kitAway: "cobalt" };
}

export function saveCareer(data) {
  localStorage.setItem(STORAGE, JSON.stringify(data));
}

export class Game {
  constructor(canvas, onHud) {
    this.canvas = canvas;
    this.onHud = onHud;
    this.input = new Input();
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 160);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    createLights(this.scene);
    this.pitch = createPitch(this.scene);
    this.cam = new MatchCamera(this.camera);
    this.physics = createPhysics();
    this.ballBody = createBallBody(this.physics.world, this.physics.ballMat);
    this.ballMesh = createBallMesh();
    this.scene.add(this.ballMesh);
    this.burst = new Burst(this.scene);

    this.players = [];
    this.phase = "menu";
    this.match = null;
    this.audio = null;
    this.raf = 0;
    this._hudAcc = 0;
    this._pendingSwitch = null;
    this._holdSwitch = 0;
    this._dribbler = null;
    this._dribbleLock = 0;
    this._kickCarry = null;
    this._kickCollider = null;
    this._passAssist = null;
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setAudio(audio) {
    this.audio = audio;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  clearPlayers() {
    for (const p of this.players) {
      this.scene.remove(p.mesh);
      this.physics.world.removeBody(p.body);
    }
    this.players = [];
  }

  spawnLineup({ mode, homeKit, awayKit, twoPlayer, testMode }) {
    this.clearPlayers();
    const home = KITS[homeKit] || KITS.crimson;
    const away = KITS[awayKit] || KITS.cobalt;
    const rows =
      mode === "3v3"
        ? [
            { team: "home", x: -9, z: 0, role: "mid", number: 10, human: true, pad: 0 },
            { team: "home", x: -5, z: -8, role: "forward", number: 9, human: false, pad: 0 },
            { team: "home", x: -17, z: 4, role: "defender", number: 4, human: false, pad: 0 },
            ...(testMode
              ? []
              : [
                  { team: "away", x: 9, z: 0, role: "mid", number: 8, human: twoPlayer, pad: 1 },
                  { team: "away", x: 5, z: 8, role: "forward", number: 11, human: false, pad: 1 },
                  { team: "away", x: 17, z: -4, role: "defender", number: 5, human: false, pad: 1 },
                ]),
          ]
        : [
            { team: "home", x: -7.5, z: 0, role: "mid", number: 10, human: true, pad: 0 },
            ...(testMode ? [] : [{ team: "away", x: 7.5, z: 0, role: "mid", number: 9, human: twoPlayer, pad: 1 }]),
          ];

    for (const row of rows) {
      const body = createPlayerBody(this.physics.world, this.physics.playerMat, row.x, row.z);
      const player = new Player({
        body,
        team: row.team,
        kit: row.team === "home" ? home : away,
        number: row.number,
        role: row.role,
        human: row.human,
        pad: row.pad,
      });
      player.reset(row.x, row.z, row.team === "home");
      this.scene.add(player.mesh);
      this.players.push(player);
    }
  }

  startMatch(options) {
    this.match = {
      mode: options.mode,
      twoPlayer: !!options.twoPlayer,
      testMode: !!options.testMode,
      ladder: !!options.ladder,
      difficulty: DIFFICULTY[options.difficulty] || DIFFICULTY.medium,
      difficultyId: options.difficulty || "medium",
      homeKit: options.homeKit || "crimson",
      awayKit: options.awayKit || "cobalt",
      homeName: options.homeName || "HOME",
      awayName: options.awayName || "AWAY",
      time: MATCH.duration,
      score: { home: 0, away: 0 },
      shots: { home: 0, away: 0 },
      poss: { home: 0, away: 0 },
      lastTouch: "home",
      kickoff: options.testMode ? 0.8 : MATCH.kickoffDelay,
      goalLock: 0,
      scoredBy: null,
      paused: false,
    };
    this._pendingSwitch = null;
    this._holdSwitch = 0;
    this.releaseDribble();
    this._dribbleLock = 0;
    this._kickCarry = null;
    this._kickCollider = null;
    this._passAssist = null;
    this.spawnLineup(this.match);
    this.resetKickoff("home");
    this.phase = "playing";
    this.input.enabled = true;
    this.audio?.whistle();
    this.emit();
  }

  resetKickoff(team = "home") {
    const sign = team === "home" ? -1 : 1;
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
    this.ballBody.position.set(0, BALL.radius + 0.04, 0);
    this.releaseDribble();
    this._passAssist = null;
    this._kickCarry = null;
    if (this._kickCollider) {
      this._kickCollider.player.body.collisionFilterMask = GROUP_WORLD | GROUP_PLAYER | GROUP_BALL;
      this._kickCollider = null;
    }
    this.players.forEach((p) => {
      let x = p.home.x;
      let z = p.home.z;
      if (this.match.mode !== "3v3") {
        x = p.team === team ? sign * 4.2 : -sign * 8;
        z = 0;
      }
      p.reset(x, z, p.team === "home");
    });
    if (this.match) this.match.kickoff = this.match.testMode ? 0.8 : MATCH.kickoffDelay;
    this.match.goalLock = 0;
    this.match.scoredBy = null;
  }

  pause() {
    if (this.phase !== "playing" || this.match?.goalLock > 0) return;
    this.match.paused = true;
    this.phase = "paused";
    this.emit();
  }

  resume() {
    if (!this.match) return;
    this.match.paused = false;
    this.phase = "playing";
    this.emit();
  }

  quitToMenu() {
    this.phase = "menu";
    this.match = null;
    this.releaseDribble();
    this.clearPlayers();
    this.ballBody.position.set(0, BALL.radius + 0.04, 0);
    this.ballBody.velocity.set(0, 0, 0);
    this.emit();
  }

  controlled(pad = 0) {
    return this.players.find((p) => p.human && p.pad === pad);
  }

  setControlled(pad, next) {
    this.players
      .filter((p) => p.pad === pad)
      .forEach((p) => {
        p.human = p === next;
      });
  }

  switchControlled(pad) {
    const squad = this.players.filter((p) => p.pad === pad);
    if (squad.length < 2) return;
    const ball = this.ballBody.position;
    const ordered = squad
      .slice()
      .sort((a, b) => dist(a.position.x, a.position.z, ball.x, ball.z) - dist(b.position.x, b.position.z, ball.x, ball.z));
    const current = squad.find((p) => p.human);
    const idx = Math.max(0, ordered.indexOf(current));
    this.setControlled(pad, ordered[(idx + 1) % ordered.length]);
  }

  autoSwitchDefense(pad) {
    if (this._passAssist || this._holdSwitch > 0) return;
    const squad = this.players.filter((p) => p.pad === pad);
    if (squad.length < 2) return;
    const current = squad.find((p) => p.human);
    if (!current || this.canReachBall(current)) return;
    if (this._dribbler && this._dribbler.team === current.team) return;
    const ball = this.ballBody.position;
    const closest = squad
      .slice()
      .sort((a, b) => dist(a.position.x, a.position.z, ball.x, ball.z) - dist(b.position.x, b.position.z, ball.x, ball.z))[0];
    const dCur = dist(current.position.x, current.position.z, ball.x, ball.z);
    const dBest = dist(closest.position.x, closest.position.z, ball.x, ball.z);
    if (closest !== current && dBest + 2.4 < dCur) this.setControlled(pad, closest);
  }

  canReachBall(player) {
    const b = this.ballBody;
    const d = dist(player.position.x, player.position.z, b.position.x, b.position.z);
    if (d <= PLAYER.kickReach) return true;
    if (d > PLAYER.firstTouchReach) return false;
    const toPlayerX = player.position.x - b.position.x;
    const toPlayerZ = player.position.z - b.position.z;
    const closing = b.velocity.x * toPlayerX + b.velocity.z * toPlayerZ;
    return closing > 2;
  }

  passReceiver(player, aim) {
    let best = null;
    let bestScore = -Infinity;
    for (const other of this.players) {
      if (other === player || other.team !== player.team) continue;
      const dx = other.position.x - player.position.x;
      const dz = other.position.z - player.position.z;
      const len = Math.hypot(dx, dz) || 1;
      if (len < 1.6 || len > PLAYER.passMaxRange) continue;
      const dot = (dx / len) * aim.x + (dz / len) * aim.z;
      const closeSlack = len < 14 ? 0.22 : 0.08;
      if (dot < PLAYER.passAssistDot - closeSlack) continue;
      const score = dot * 1.7 - len * 0.006;
      if (score > bestScore) {
        bestScore = score;
        best = other;
      }
    }
    return best;
  }

  passDelivery(receiver, ball) {
    const dx = receiver.position.x - ball.position.x;
    const dz = receiver.position.z - ball.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const time = Math.min(1.35, 0.14 + len / 18);
    const tx = receiver.position.x + receiver.body.velocity.x * time * 0.55;
    const tz = receiver.position.z + receiver.body.velocity.z * time * 0.55;
    const pdx = tx - ball.position.x;
    const pdz = tz - ball.position.z;
    const plen = Math.hypot(pdx, pdz) || 1;
    const power = THREE.MathUtils.clamp(PLAYER.passArriveSpeed + plen * 1.15, 18, 34);
    return { dir: { x: pdx / plen, z: pdz / plen }, power };
  }

  guidePass(dt) {
    const assist = this._passAssist;
    if (!assist) return;
    assist.time -= dt;
    if (assist.time <= 0 || this._dribbler) {
      this._passAssist = null;
      return;
    }
    const receiver = assist.receiver;
    if (!receiver || receiver.stun > 0) {
      this._passAssist = null;
      return;
    }
    const b = this.ballBody;
    const tx = receiver.position.x + receiver.body.velocity.x * 0.2;
    const tz = receiver.position.z + receiver.body.velocity.z * 0.2;
    const dx = tx - b.position.x;
    const dz = tz - b.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const spd = Math.hypot(b.velocity.x, b.velocity.z);
    const t = 1 - Math.exp(-5.2 * dt);
    const keep = Math.max(spd, len < 3.2 ? 7 : 14);
    b.velocity.x += ((dx / len) * keep - b.velocity.x) * t;
    b.velocity.z += ((dz / len) * keep - b.velocity.z) * t;
    if (len < 2.8) {
      b.position.x += (tx - b.position.x) * 0.35;
      b.position.z += (tz - b.position.z) * 0.35;
      b.velocity.x *= 0.92;
      b.velocity.z *= 0.92;
    }
  }

  throughTarget(player, aim) {
    const attackX = player.team === "home" ? 1 : -1;
    const mate = this.passReceiver(player, aim);
    if (mate) {
      const tx = mate.position.x + mate.body.velocity.x * 0.75 + aim.x * 5 + attackX * 2.2;
      const tz = mate.position.z + mate.body.velocity.z * 0.75 + aim.z * 5;
      const dx = tx - player.position.x;
      const dz = tz - player.position.z;
      const len = Math.hypot(dx, dz) || 1;
      return { dir: { x: dx / len, z: dz / len }, receiver: mate };
    }
    const x = aim.x * 0.55 + attackX * 0.45;
    const z = aim.z * 0.55;
    const len = Math.hypot(x, z) || 1;
    return { dir: { x: x / len, z: z / len }, receiver: null };
  }

  shotAim(player, aim) {
    const goalX = player.team === "home" ? PITCH.length / 2 : -PITCH.length / 2;
    const dx = goalX - player.position.x;
    const dz = 0 - player.position.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: aim.x * 0.72 + (dx / len) * 0.28,
      z: aim.z * 0.72 + (dz / len) * 0.28,
    };
  }

  tryAction(player, kind, charge = 0) {
    if (this.canReachBall(player)) {
      this.kickBall(player, kind, charge);
      return true;
    }
    player.whiffing = 0.28;
    player.kickLock = 0.22;
    this.audio?.whiff();
    this.emit("whiff");
    return false;
  }

  kickBall(player, kind, charge = 0) {
    if (typeof kind === "number") {
      charge = kind;
      kind = charge < 0.2 ? "pass" : "shot";
    }
    const b = this.ballBody;
    if (!this.canReachBall(player)) return false;
    this.releaseDribble();
    let aim = player.human ? player.aimDir() : player.faceDir();
    let dir = aim;
    let power = PLAYER.passPower;
    let loft = 0.5;
    let spread = 0.04;
    let receiver = null;

    if (kind === "pass") {
      receiver = this.passReceiver(player, aim);
      if (receiver) {
        const delivery = this.passDelivery(receiver, b);
        dir = delivery.dir;
        power = delivery.power;
        spread = 0;
        this._passAssist = { receiver, from: player, time: 1.35 };
      } else {
        dir = aim;
        power = PLAYER.passPower;
        this._passAssist = null;
      }
      loft = 0.12;
    } else if (kind === "through") {
      const thru = this.throughTarget(player, aim);
      dir = thru.dir;
      receiver = thru.receiver;
      power = PLAYER.throughPower;
      loft = 0.22;
      spread = 0.02;
      this._passAssist = receiver ? { receiver, from: player, time: 1.05 } : null;
    } else {
      dir = this.shotAim(player, aim);
      const t = Math.min(1, Math.max(0, charge));
      power = PLAYER.shotPowerMin + t * (PLAYER.shotPowerMax - PLAYER.shotPowerMin) + player.speed() * 0.16;
      loft = 0.3 + t * t * 0.9;
      if (player.human) console.info("[shot]", { charge: Number(t.toFixed(2)), power: Number(power.toFixed(1)), loft: Number(loft.toFixed(2)) });
      const face = player.faceDir();
      const sideSlip = Math.abs(face.x * player.body.velocity.z - face.z * player.body.velocity.x) / 8;
      spread = (1 - t) * 0.07 + sideSlip * 0.05 + (player.stun > 0 ? 0.06 : 0);
      this.match.shots[player.team] += 1;
      this._passAssist = null;
      this.cam.punch(0.28 + t * 0.5);
    }

    this._dribbleLock = Math.max(
      this._dribbleLock,
      kind === "shot" ? 0.22 + Math.max(0, power - 24) / 55 : kind === "through" ? 0.16 : 0.12
    );

    const n = Math.hypot(dir.x, dir.z) || 1;
    dir = { x: dir.x / n, z: dir.z / n };
    if (kind === "shot" && power > 22) {
      const clearance = PLAYER.radius + BALL.radius + 0.06;
      b.position.x += dir.x * clearance;
      b.position.z += dir.z * clearance;
    }
    b.velocity.set(
      dir.x * power + (Math.random() - 0.5) * spread * power,
      loft,
      dir.z * power + (Math.random() - 0.5) * spread * power
    );
    const face = player.faceDir();
    const sidespin = aim.x * face.z - aim.z * face.x;
    b.angularVelocity.set(
      -dir.z * (8 + charge * 16),
      sidespin * (16 + charge * 22) + dir.x * 6,
      dir.x * 6
    );
    b.position.y = Math.max(b.position.y, BALL.radius + (kind === "shot" ? charge * 0.12 : 0));
    b.wakeUp();
    if (kind === "shot" && power > 22) {
      player.body.collisionFilterMask = GROUP_WORLD | GROUP_PLAYER;
      this._kickCollider = { player, time: 0.2 };
      this._kickCarry = { player, time: 0.22 + Math.max(0, power - 26) / 75 };
    } else {
      this._kickCarry = null;
    }
    this.match.lastTouch = player.team;
    player.kickKind = kind === "through" ? "pass" : kind;
    player.kickLock = kind === "shot" ? 0.32 : 0.55;
    player.facing = Math.atan2(dir.x, dir.z);
    this.audio?.kick();
    if (kind === "pass") this.cam.punch(0.18);
    if (kind === "through") this.cam.punch(0.24);
    if (player.human && receiver && (kind === "pass" || kind === "through")) {
      this.setControlled(player.pad, receiver);
      this._holdSwitch = 1.8;
      this._pendingSwitch = null;
    }
    return true;
  }

  applyMagnus(dt) {
    if (this._dribbler) return;
    const v = this.ballBody.velocity;
    const w = this.ballBody.angularVelocity;
    const spd = Math.hypot(v.x, v.y, v.z);
    if (spd < 2) return;
    const k = BALL.magnus;
    v.x += (w.y * v.z - w.z * v.y) * k * dt;
    v.y += (w.z * v.x - w.x * v.z) * k * 0.35 * dt;
    v.z += (w.x * v.y - w.y * v.x) * k * dt;
  }

  tickKickState(dt) {
    if (this._kickCarry) {
      this._kickCarry.time -= dt;
      if (this._kickCarry.time <= 0) this._kickCarry = null;
    }
    if (this._kickCollider) {
      this._kickCollider.time -= dt;
      if (this._kickCollider.time <= 0) {
        this._kickCollider.player.body.collisionFilterMask = GROUP_WORLD | GROUP_PLAYER | GROUP_BALL;
        this._kickCollider = null;
      }
    }
  }

  releaseDribble() {
    if (this._dribbler) {
      this._dribbler.body.collisionFilterMask = GROUP_WORLD | GROUP_PLAYER | GROUP_BALL;
      this._dribbler = null;
    }
  }

  ballOwner() {
    if (this._dribbleLock > 0) return null;
    const b = this.ballBody;
    if (b.position.y > 1.15) return null;
    const pass = this._passAssist;
    const passer = pass?.from;
    const intended = pass?.receiver;
    if (intended && intended.sliding <= 0 && intended.stun <= 0) {
      const recD = dist(intended.position.x, intended.position.z, b.position.x, b.position.z);
      if (recD < PLAYER.controlKeepRadius + 0.7) return intended;
    }
    const keeper = this._dribbler;
    if (keeper && keeper !== passer && keeper.sliding <= 0 && keeper.stun <= 0 && keeper.kickLock <= 0.08) {
      const keepD = dist(keeper.position.x, keeper.position.z, b.position.x, b.position.z);
      if (keepD < PLAYER.controlKeepRadius) {
        let steal = null;
        let stealD = PLAYER.stealRadius;
        for (const p of this.players) {
          if (p === keeper || p === passer || p.sliding > 0 || p.stun > 0 || p.kickLock > 0.08) continue;
          const d = dist(p.position.x, p.position.z, b.position.x, b.position.z);
          if (d < stealD) {
            stealD = d;
            steal = p;
          }
        }
        if (!steal) return keeper;
      }
    }
    let best = null;
    let bestD = PLAYER.controlRadius;
    for (const p of this.players) {
      if (p === passer || p.sliding > 0 || p.stun > 0 || p.kickLock > 0.08) continue;
      if (this._kickCarry?.player === p && this._kickCarry.time > 0) continue;
      const d = dist(p.position.x, p.position.z, b.position.x, b.position.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  applyDribble() {
    const owner = this.ballOwner();
    if (this._dribbler && this._dribbler !== owner) this.releaseDribble();
    if (!owner) return false;

    owner.body.collisionFilterMask = GROUP_WORLD | GROUP_PLAYER;
    this._dribbler = owner;

    const b = this.ballBody;
    const dir = owner.human ? owner.aimDir() : owner.faceDir();
    const spd = owner.speed();
    const hold = PLAYER.dribbleHold + Math.min(0.14, spd * 0.012);
    const tx = owner.position.x + dir.x * hold;
    const tz = owner.position.z + dir.z * hold;
    const pv = owner.body.velocity;
    b.velocity.x = pv.x * 0.98 + (tx - b.position.x) * 22;
    b.velocity.z = pv.z * 0.98 + (tz - b.position.z) * 22;
    b.velocity.y *= 0.35;
    b.position.x += (tx - b.position.x) * 0.45;
    b.position.z += (tz - b.position.z) * 0.45;
    const d = dist(owner.position.x, owner.position.z, b.position.x, b.position.z);
    if (d < PLAYER.radius + BALL.radius + 0.35) {
      b.position.x = tx;
      b.position.z = tz;
    }
    b.position.y = Math.max(b.position.y, BALL.radius);
    b.angularVelocity.set(-dir.z * (6 + spd * 1.4), 0, dir.x * (6 + spd * 1.4));
    this.match.lastTouch = owner.team;
    return true;
  }

  tryHeader(player) {
    const b = this.ballBody;
    if (player.grounded || b.position.y < 1.05) return;
    if (dist(player.position.x, player.position.z, b.position.x, b.position.z) > 1.55) return;
    const dir = player.human ? player.aimDir() : player.faceDir();
    this.releaseDribble();
    this._dribbleLock = 0.28;
    b.velocity.set(dir.x * 11, 1.1, dir.z * 11);
    this.match.lastTouch = player.team;
    this.audio?.kick();
    this.cam.punch(0.32);
  }

  tryTackleContact(player) {
    if (player.sliding <= 0) return;
    const b = this.ballBody;
    if (dist(player.position.x, player.position.z, b.position.x, b.position.z) < 1.15) {
      const dir = player.faceDir();
      b.velocity.set(dir.x * 7, 0.5, dir.z * 7);
      this.match.lastTouch = player.team;
    }
    for (const other of this.players) {
      if (other.team === player.team) continue;
      if (dist(player.position.x, player.position.z, other.position.x, other.position.z) < 1.05) {
        other.stun = 0.5;
      }
    }
  }

  containPlay() {
    const halfL = PITCH.length / 2;
    const halfW = PITCH.width / 2;
    const gw = PITCH.goalWidth / 2 - 0.08;
    const b = this.ballBody;
    const ballR = BALL.radius + 0.01;
    const bounce = 0.88;
    const inMouth = Math.abs(b.position.z) < gw && b.position.y < PITCH.goalHeight + 0.05;
    const maxBallZ = fieldLimit(halfW, ballR);
    const maxBallX = fieldLimit(halfL, ballR);

    if (Math.abs(b.position.z) > maxBallZ) {
      b.position.z = Math.sign(b.position.z || 1) * maxBallZ;
      if (b.velocity.z * b.position.z > 0) b.velocity.z *= -bounce;
      b.wakeUp();
    }

    if (Math.abs(b.position.x) > maxBallX && !inMouth) {
      b.position.x = Math.sign(b.position.x || 1) * maxBallX;
      if (b.velocity.x * b.position.x > 0) b.velocity.x *= -bounce;
      b.wakeUp();
    }

    for (const p of this.players) {
      const clamped = clampInsideBoards(p.body.position.x, p.body.position.z, PLAYER.boundsRadius);
      if (p.body.position.x !== clamped.x || p.body.position.z !== clamped.z) {
        p.body.position.x = clamped.x;
        p.body.position.z = clamped.z;
        p.body.velocity.x *= 0.35;
        p.body.velocity.z *= 0.35;
      }
    }
  }

  detectGoal() {
    if (this.match.goalLock > 0 || this.match.kickoff > 0) return;
    const b = this.ballBody.position;
    const half = PITCH.length / 2;
    const inMouth = Math.abs(b.z) < PITCH.goalWidth / 2 && b.y < PITCH.goalHeight;
    let team = null;
    if (b.x > half && b.x < half + PITCH.goalDepth + 0.2 && inMouth) team = "home";
    if (b.x < -half && b.x > -half - PITCH.goalDepth - 0.2 && inMouth) team = "away";
    if (!team) return;
    this.match.score[team] += 1;
    this.match.scoredBy = team;
    this.match.goalLock = MATCH.goalHold;
    this.players.forEach((p) => {
      p.celebrating = p.team === team;
    });
    this.burst.spawn(b.x, 1.4, b.z, team === "home" ? 0xdc2626 : 0x2563eb);
    this.cam.punch(0.85);
    this.audio?.goal();
    this.emit("goal");
  }

  endMatch() {
    this.phase = "fulltime";
    this.audio?.whistle();
    const m = this.match;
    const result = {
      ...m,
      possession: {
        home: Math.round((m.poss.home / Math.max(1, m.poss.home + m.poss.away)) * 100),
        away: Math.round((m.poss.away / Math.max(1, m.poss.home + m.poss.away)) * 100),
      },
      winner: m.score.home === m.score.away ? "draw" : m.score.home > m.score.away ? "home" : "away",
    };
    if (m.ladder) {
      const career = loadCareer();
      if (result.winner === "home") career.wins += 1;
      else if (result.winner === "away") career.losses += 1;
      saveCareer(career);
    }
    this.onHud?.({ phase: "fulltime", match: result, career: loadCareer() });
  }

  emit(event) {
    const p1 = this.controlled(0);
    const p2 = this.controlled(1);
    const canSwitch = this.players.filter((p) => p.pad === 0).length > 1;
    const hasBall = !!(p1 && (this._dribbler === p1 || this.canReachBall(p1)));
    this.onHud?.({
      phase: this.phase,
      event,
      match: this.match,
      p1,
      p2,
      players: this.players,
      ball: this.ballBody,
      career: loadCareer(),
      prompt: {
        hasBall,
        canSwitch,
        defending: !!(p1 && !hasBall),
      },
    });
  }

  updatePlaying(dt) {
    const m = this.match;
    if (m.paused) return;

    if (m.goalLock > 0) {
      m.goalLock -= dt;
      this.applyMagnus(dt);
      this.physics.world.step(1 / 60, dt, 3);
      this.syncMeshes(dt);
      if (m.goalLock <= 0) {
        if (!m.testMode && m.time <= 0) {
          this.endMatch();
          return;
        }
        this.players.forEach((p) => {
          p.celebrating = false;
        });
        this.resetKickoff(m.scoredBy === "home" ? "away" : "home");
        this.audio?.whistle();
      }
      this.emit();
      return;
    }

    if (m.kickoff > 0) {
      m.kickoff -= dt;
      this.syncMeshes(dt);
      this.emit();
      return;
    }

    if (!m.testMode) m.time = Math.max(0, m.time - dt);
    this.input.enabled = true;
    const now = performance.now() / 1000;

    for (const player of this.players) {
      let wishX = 0;
      let wishZ = 0;
      let sprinting = false;
      if (player.human) {
        const input = this.input.state(player.pad);
        if (input.switchPlayer) this.switchControlled(player.pad);
        const wish = player.applyInput(input, this.camera, dt);
        wishX = wish.wishX;
        wishZ = wish.wishZ;
        player.wishX = wishX;
        player.wishZ = wishZ;
        if (Math.hypot(wishX, wishZ) > 0.2) player.facing = Math.atan2(wishX, wishZ);
        sprinting = wish.sprinting;
        if (input.jump) player.jump();
        if (input.tackle && player.tackle()) {
          this.audio?.tackle();
          this.cam.punch(0.42);
        }
        if (input.pass) {
          player.charging = false;
          player.charge = 0;
          this.tryAction(player, "pass");
        } else if (input.through) {
          player.charging = false;
          player.charge = 0;
          this.tryAction(player, "through");
        } else {
          if (input.shootStart) player.startCharge();
          player.tickCharge(dt);
          if (input.shootEnd) {
            const charge = player.releaseKick();
            if (charge !== null) this.tryAction(player, "shot", charge);
          }
        }
      } else {
        const ai = thinkAI(player, {
          ball: this.ballBody,
          players: this.players,
          difficulty: m.difficulty,
          now,
          incoming: this._passAssist?.receiver === player ? this.ballBody : null,
          carrier: this._dribbler,
        });
        wishX = ai.wishX;
        wishZ = ai.wishZ;
        sprinting = ai.sprinting;
        if (ai.jump) player.jump();
        if (ai.tackle && player.tackle()) {
          this.audio?.tackle();
          this.cam.punch(0.36);
        }
        if (ai.kick > 0) this.kickBall(player, ai.kick);
      }
      const hasBall =
        this._dribbler === player ||
        dist(player.position.x, player.position.z, this.ballBody.position.x, this.ballBody.position.z) < PLAYER.controlRadius;
      player.move(wishX, wishZ, sprinting, dt, hasBall);
      this.tryHeader(player);
      this.tryTackleContact(player);
    }

    if (this._pendingSwitch) {
      this._pendingSwitch.wait -= dt;
      if (this._pendingSwitch.wait <= 0) {
        this.setControlled(this._pendingSwitch.pad, this._pendingSwitch.player);
        this._holdSwitch = 0.5;
        this._pendingSwitch = null;
      }
    }
    this._holdSwitch = Math.max(0, this._holdSwitch - dt);
    this.autoSwitchDefense(0);
    if (m.twoPlayer) this.autoSwitchDefense(1);

    this.applyMagnus(dt);
    this.physics.world.step(1 / 60, dt, 3);
    this._dribbleLock = Math.max(0, this._dribbleLock - dt);
    this.tickKickState(dt);
    this.guidePass(dt);
    this.containPlay();
    this.ballBody.position.y = Math.max(this.ballBody.position.y, BALL.radius);
    if (this.applyDribble()) m.poss[this._dribbler.team] += dt;
    else m.poss[m.lastTouch] += dt * 0.35;
    this.detectGoal();
    this.syncMeshes(dt);
    if (!m.testMode && m.time <= 0 && m.goalLock <= 0) this.endMatch();
    else {
      this._hudAcc += dt;
      if (this._hudAcc > 0.1) {
        this._hudAcc = 0;
        this.emit();
      }
    }
  }

  syncMeshes(dt) {
    const b = this.ballBody;
    this.ballMesh.position.set(b.position.x, b.position.y, b.position.z);
    this.ballMesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const c0 = this.controlled(0);
    const c1 = this.controlled(1);
    const target0 = c0 ? this.passReceiver(c0, c0.aimDir()) : null;
    const target1 = c1 ? this.passReceiver(c1, c1.aimDir()) : null;
    for (const p of this.players) {
      if (p.body.position.y < 0) p.body.position.y = 0;
      p.sync(dt, p === c0 || p === c1);
      p.parts.passTarget.visible = p === target0 || p === target1;
    }
    this.burst.update(dt);
    const focus = this.phase === "playing" ? c0 : null;
    this.cam.update(dt, b, focus);
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.033, this.clock.getDelta());
    if (this.phase === "playing") {
      this.updatePlaying(dt);
    } else {
      this.ballBody.position.y = Math.max(this.ballBody.position.y, BALL.radius);
      if (this.phase === "menu") {
        const t = this.clock.elapsedTime;
        this.cam.pos.set(Math.sin(t * 0.12) * 8, 17, 26);
        this.cam.look.set(0, 0.2, 0);
        this.camera.position.copy(this.cam.pos);
        this.camera.lookAt(this.cam.look);
        this.ballMesh.position.set(this.ballBody.position.x, this.ballBody.position.y, this.ballBody.position.z);
      } else {
        this.syncMeshes(dt);
      }
    }
    this.input.beginFrame();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    this.input.dispose();
    this.renderer.dispose();
  }
}
