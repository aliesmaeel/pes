import { PITCH, PLAYER } from "../config.js";

function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function thinkAI(player, ctx) {
  const { ball, players, difficulty, now, incoming, carrier } = ctx;
  if (player.human || player.stun > 0) return { wishX: 0, wishZ: 0, sprinting: false, jump: false, tackle: false, kick: 0 };

  if (now < (player._reactAt ?? 0)) {
    return player._lastThink ?? { wishX: 0, wishZ: 0, sprinting: false, jump: false, tackle: false, kick: 0 };
  }
  player._reactAt = now + difficulty.reaction;

  const px = player.position.x;
  const pz = player.position.z;
  const bx = ball.position.x;
  const bz = ball.position.z;
  const goalX = player.team === "home" ? PITCH.length / 2 : -PITCH.length / 2;
  const ownGoalX = -goalX;
  const attackX = player.team === "home" ? 1 : -1;

  const teammates = players.filter((p) => p.team === player.team);
  const opponents = players.filter((p) => p.team !== player.team);
  const closestTeam = teammates.slice().sort((a, b) => dist2(a.position.x, a.position.z, bx, bz) - dist2(b.position.x, b.position.z, bx, bz))[0];
  const teamHasBall = !!(carrier && carrier.team === player.team && carrier !== player);
  const onBall = !teamHasBall && closestTeam === player;
  const ballNear = dist2(px, pz, bx, bz) < PLAYER.controlRadius ** 2 * 1.15;
  const oppNearBall = opponents.some((o) => dist2(o.position.x, o.position.z, bx, bz) < 1.8 ** 2);

  let tx = player.home.x;
  let tz = player.home.z;
  let sprint = false;
  let jump = false;
  let tackle = false;
  let kick = 0;

  if (incoming) {
    tx = incoming.position.x + incoming.velocity.x * 0.28;
    tz = incoming.position.z + incoming.velocity.z * 0.28;
    sprint = true;
  } else if (teamHasBall) {
    const cx = carrier.position.x;
    const cz = carrier.position.z;
    const side = Math.sign(player.home.z - cz) || (player.number % 2 ? 1 : -1);
    if (player.role === "forward") {
      tx = cx + attackX * 10;
      tz = cz + side * 9;
    } else if (player.role === "defender") {
      tx = cx - attackX * 9;
      tz = player.home.z * 0.55 + cz * 0.2;
    } else {
      tx = cx + attackX * 6;
      tz = cz + side * 11;
    }
    tx = Math.max(-PITCH.length / 2 + 2, Math.min(PITCH.length / 2 - 2, tx));
    tz = Math.max(-PITCH.width / 2 + 2, Math.min(PITCH.width / 2 - 2, tz));
    const gap2 = dist2(px, pz, cx, cz);
    if (gap2 < 8.5 ** 2) {
      const gap = Math.sqrt(gap2) || 1;
      tx = px + ((px - cx) / gap) * 11;
      tz = pz + ((pz - cz) / gap) * 11;
    }
    sprint = dist2(px, pz, tx, tz) > 14 ** 2;
  } else if (onBall) {
    if (ballNear && !oppNearBall) {
      tx = goalX;
      tz = THREE_Z(bz, 0.35);
      sprint = difficulty.press > 0.6;
      const toGoal = Math.abs(goalX - px);
      const facingGoal = player.team === "home" ? player.faceDir().x > 0.25 : player.faceDir().x < -0.25;
      if (toGoal < difficulty.shootRange && facingGoal && Math.abs(pz) < PITCH.goalWidth) {
        kick = 0.55 + Math.random() * 0.4 * difficulty.accuracy;
      } else if (toGoal < 18 && Math.random() < 0.012) {
        kick = 0.22;
      }
    } else {
      tx = bx + ball.velocity.x * 0.18;
      tz = bz + ball.velocity.z * 0.18;
      sprint = true;
      if (ballNear && oppNearBall && player.tackleCd <= 0 && Math.random() < difficulty.press) {
        tackle = true;
      }
      if (ball.position.y > 1.15 && dist2(px, pz, bx, bz) < 2.2 ** 2) jump = true;
    }
  } else if (player.role === "defender") {
    tx = THREE_X(ownGoalX * 0.55 + bx * 0.18, player.team);
    tz = bz * 0.45;
    if (dist2(px, pz, bx, bz) < 16 && difficulty.press > 0.7) {
      tx = bx;
      tz = bz;
      sprint = true;
    }
  } else if (player.role === "forward") {
    tx = goalX * 0.55 + bx * 0.1;
    tz = player.home.z * 0.4 + bz * 0.25;
  } else {
    tx = (bx + goalX * 0.25) * 0.5;
    tz = bz * 0.4;
  }

  const dx = tx - px;
  const dz = tz - pz;
  const len = Math.hypot(dx, dz) || 1;
  const jitter = (1 - difficulty.accuracy) * 0.28;
  const think = {
    wishX: (dx / len) * difficulty.speed + (Math.random() - 0.5) * jitter,
    wishZ: (dz / len) * difficulty.speed + (Math.random() - 0.5) * jitter,
    sprinting: sprint && player.stamina > 10,
    jump,
    tackle,
    kick,
  };
  player._lastThink = think;
  return think;
}

function THREE_Z(z, keep) {
  return z * keep;
}

function THREE_X(x, team) {
  if (team === "home") return Math.min(-2, x);
  return Math.max(2, x);
}
