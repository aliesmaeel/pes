import * as CANNON from "cannon-es";
import { BALL, PITCH, PLAYER } from "../config.js";

export function createPhysics() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -18, 0),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.35;
  world.defaultContactMaterial.restitution = 0.25;

  const ballMat = new CANNON.Material("ball");
  const groundMat = new CANNON.Material("ground");
  const playerMat = new CANNON.Material("player");
  const postMat = new CANNON.Material("post");
  const boardMat = new CANNON.Material("board");

  world.addContactMaterial(
    new CANNON.ContactMaterial(ballMat, groundMat, {
      friction: 0.42,
      restitution: 0.5,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(ballMat, playerMat, {
      friction: 0.15,
      restitution: 0.08,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(ballMat, boardMat, {
      friction: 0.04,
      restitution: 0.92,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(ballMat, postMat, {
      friction: 0.2,
      restitution: 0.62,
    })
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(playerMat, groundMat, {
      friction: 0,
      restitution: 0,
    })
  );

  const halfL = PITCH.length / 2;
  const halfW = PITCH.width / 2;
  const gw = PITCH.goalWidth / 2;
  const gh = PITCH.goalHeight;
  const gd = PITCH.goalDepth;

  const ground = new CANNON.Body({ mass: 0, material: groundMat });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  const wall = (x, z, sx, sz, y = 1.2, mat = boardMat) => {
    const body = new CANNON.Body({ mass: 0, material: mat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx, y, sz)));
    body.position.set(x, y, z);
    world.addBody(body);
    return body;
  };

  const boardH = PITCH.wallHeight / 2;
  const thick = 0.32;
  wall(0, halfW + thick, halfL + 1.2, thick, boardH);
  wall(0, -halfW - thick, halfL + 1.2, thick, boardH);

  const end = (sign) => {
    const x = sign * (halfL + thick);
    const span = halfW - gw;
    wall(x, (gw + halfW) / 2, thick, span / 2 + 0.12, boardH);
    wall(x, -(gw + halfW) / 2, thick, span / 2 + 0.12, boardH);
    wall(sign * (halfL + gd), 0, 0.3, gw + 0.15, gh / 2, postMat);
    wall(sign * (halfL + gd / 2), gw, gd / 2 + 0.1, 0.12, gh / 2, postMat);
    wall(sign * (halfL + gd / 2), -gw, gd / 2 + 0.1, 0.12, gh / 2, postMat);

    const bar = new CANNON.Body({ mass: 0, material: postMat });
    bar.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 0.1, gw + 0.12)));
    bar.position.set(sign * halfL, gh, 0);
    world.addBody(bar);
  };
  end(1);
  end(-1);

  return { world, ballMat, playerMat, groundMat, postMat };
}

export const GROUP_WORLD = 1;
export const GROUP_PLAYER = 2;
export const GROUP_BALL = 4;

export function createBallBody(world, ballMat) {
  const body = new CANNON.Body({
    mass: BALL.mass,
    material: ballMat,
    linearDamping: 0.22,
    angularDamping: 0.28,
    allowSleep: true,
    collisionFilterGroup: GROUP_BALL,
    collisionFilterMask: GROUP_WORLD | GROUP_PLAYER,
  });
  body.addShape(new CANNON.Sphere(BALL.radius));
  body.position.set(0, BALL.radius + 0.02, 0);
  world.addBody(body);
  return body;
}

export function createPlayerBody(world, playerMat, x, z) {
  const body = new CANNON.Body({
    mass: PLAYER.mass,
    material: playerMat,
    linearDamping: 0.4,
    angularDamping: 1,
    fixedRotation: true,
    allowSleep: false,
    collisionFilterGroup: GROUP_PLAYER,
    collisionFilterMask: GROUP_WORLD | GROUP_PLAYER | GROUP_BALL,
  });
  body.addShape(new CANNON.Sphere(PLAYER.radius), new CANNON.Vec3(0, PLAYER.radius, 0));
  body.position.set(x, 0, z);
  body.updateMassProperties();
  world.addBody(body);
  return body;
}
