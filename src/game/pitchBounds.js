import { PITCH } from "../config.js";

/** Inner playable limit along one axis (wall face minus entity radius). */
export function fieldLimit(halfSpan, radius) {
  return halfSpan + PITCH.boardInset - radius;
}

/** Clamp a circular entity inside the boarded pitch. */
export function clampInsideBoards(x, z, radius) {
  const halfL = PITCH.length / 2;
  const halfW = PITCH.width / 2;
  const maxX = fieldLimit(halfL, radius);
  const maxZ = fieldLimit(halfW, radius);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    z: Math.max(-maxZ, Math.min(maxZ, z)),
  };
}
